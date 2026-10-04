export type PendingDispatch = {
  revision: string;
  attempts: number;
  retryAt: number;
  authenticationBlocked: boolean;
};
export type SchedulerState = { revision?: string; pending?: PendingDispatch };
export type Upload = { revision: string; activated: boolean };
export class ProviderError extends Error {
  status: number;
  retryAfter: number;
  constructor(status: number, retryAfter = 0) {
    super("Provider request failed");
    this.status = status;
    this.retryAfter =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0;
  }
}

export class PublisherScheduler {
  private firstEdit?: number;
  private lastEdit?: number;
  private reconcileAt: number;
  private uploadRetryAt = 0;
  private uploadFailures = 0;
  private running = false;
  private recovered = false;
  state: SchedulerState;
  private dependencies: {
    now(): number;
    upload(): Promise<Upload>;
    dispatch(revision: string): Promise<void>;
    persist(state: SchedulerState): Promise<void>;
    notice(
      status:
        | "uploaded"
        | "queued"
        | "upload_failed"
        | "dispatch_failed"
        | "authentication_required",
    ): void;
    recovered?(revision: string): Promise<boolean>;
  };

  constructor(
    state: SchedulerState,
    dependencies: PublisherScheduler["dependencies"],
  ) {
    this.state = structuredClone(state);
    this.dependencies = dependencies;
    this.reconcileAt = dependencies.now();
  }

  edited(): void {
    const now = this.dependencies.now();
    this.firstEdit ??= now;
    this.lastEdit = now;
  }

  async manual(): Promise<void> {
    const now = this.dependencies.now();
    this.reconcileAt = now;
    this.uploadRetryAt = 0;
    this.uploadFailures = 0;
    if (this.state.pending) {
      this.state.pending.retryAt = now;
      this.state.pending.authenticationBlocked = false;
      await this.dependencies.persist(this.state);
    }
    await this.tick();
  }

  async tick(): Promise<void> {
    if (this.running) return;
    const now = this.dependencies.now();
    const dirtyAt =
      this.firstEdit === undefined
        ? Infinity
        : Math.min(this.firstEdit + 120000, this.lastEdit! + 60000);
    this.running = true;
    try {
      if (!this.recovered) {
        if (
          this.state.pending &&
          this.dependencies.recovered &&
          (await this.dependencies.recovered(this.state.pending.revision))
        ) {
          const next = { revision: this.state.revision };
          await this.dependencies.persist(next);
          this.state = next;
        }
        this.recovered = true;
      }
      if (
        now >= this.uploadRetryAt &&
        now >= Math.min(dirtyAt, this.reconcileAt)
      ) {
        const first = this.firstEdit,
          last = this.lastEdit;
        this.firstEdit = undefined;
        this.lastEdit = undefined;
        this.reconcileAt = now + 300000;
        try {
          const uploaded = await this.dependencies.upload();
          if (uploaded.activated || this.state.revision !== uploaded.revision) {
            const next = {
              revision: uploaded.revision,
              pending: {
                revision: uploaded.revision,
                attempts: 0,
                retryAt: now,
                authenticationBlocked: false,
              },
            };
            await this.dependencies.persist(next);
            this.state = next;
            this.dependencies.notice("uploaded");
          }
          this.uploadRetryAt = 0;
          this.uploadFailures = 0;
        } catch {
          this.firstEdit ??= first;
          this.lastEdit ??= last;
          this.uploadFailures++;
          this.uploadRetryAt =
            now +
            Math.min(300000, 60000 * 2 ** Math.min(this.uploadFailures - 1, 3));
          this.reconcileAt = Math.min(this.reconcileAt, this.uploadRetryAt);
          this.dependencies.notice("upload_failed");
        }
      }
      const pending = this.state.pending;
      if (pending && !pending.authenticationBlocked && pending.retryAt <= now) {
        try {
          await this.dependencies.dispatch(pending.revision);
          const next = { revision: this.state.revision };
          await this.dependencies.persist(next);
          this.state = next;
          this.dependencies.notice("queued");
        } catch (error) {
          pending.attempts++;
          const provider = error instanceof ProviderError ? error : undefined;
          pending.authenticationBlocked =
            provider?.status === 401 || provider?.status === 403;
          const backoff = Math.min(
            300000,
            Math.max(
              10000 * 2 ** Math.min(pending.attempts - 1, 5),
              provider?.retryAfter ?? 0,
            ),
          );
          pending.retryAt = now + backoff;
          this.state.pending = pending;
          await this.dependencies.persist(this.state);
          this.dependencies.notice(
            pending.authenticationBlocked
              ? "authentication_required"
              : "dispatch_failed",
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
