import { ProviderError } from "./scheduler.ts";

export async function dispatchContent(
  token: string,
  revision: string,
  request: typeof fetch = fetch,
): Promise<void> {
  if (!token || !/^[a-f0-9]{64}$/.test(revision))
    throw new Error("Invalid dispatch configuration");
  const response = await request(
    "https://api.github.com/repos/JustinDFuller/justindfuller.com/actions/workflows/cloudflare.yml/dispatches",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { publish_kind: "content", source_revision: revision },
      }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  await response.body?.cancel();
  if (response.status !== 204)
    throw new ProviderError(
      response.status,
      Number(response.headers.get("retry-after") ?? 0) * 1000,
    );
}
