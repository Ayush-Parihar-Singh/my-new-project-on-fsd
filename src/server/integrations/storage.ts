// Private object storage (local volume). Files live outside /public and are only served
// through authorized Route Handlers. Keys are server-generated; user input never forms a path.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

const root = path.resolve(process.cwd(), env.STORAGE_DIR);
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}\.(jpg|png|webp)$/;

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
  return path.join(root, key);
}

export const privateStorage = {
  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(resolveKey(key), data, { mode: 0o600, flag: "wx" });
  },
  async get(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
  },
  async remove(key: string): Promise<void> {
    await unlink(resolveKey(key)).catch(() => undefined);
  },
};
