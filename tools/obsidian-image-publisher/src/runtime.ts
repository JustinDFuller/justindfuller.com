import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";

export async function writeRuntimeState(
  path: string,
  body: string,
): Promise<void> {
  const pending = `${path}.${randomUUID()}.pending`;
  try {
    await writeFile(pending, body, { flag: "wx", mode: 0o600 });
    await rename(pending, path);
  } finally {
    await unlink(pending).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
