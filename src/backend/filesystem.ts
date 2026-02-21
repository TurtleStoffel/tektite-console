import { mkdir } from "node:fs/promises";

export async function ensureDirectoryExists(dir: string) {
    await mkdir(dir, { recursive: true });
}
