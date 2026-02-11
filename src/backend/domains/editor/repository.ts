import fs from "node:fs";
import path from "node:path";
import { execFileAsync } from "../../exec";
import { isWithinRoot } from "../../http/pathUtils";

export function resolveAllowedFolder(
    options: { clonesDir: string; productionDir: string },
    rawPath: string,
) {
    const folderPath = path.resolve(rawPath);
    const allowed =
        isWithinRoot(folderPath, options.clonesDir) ||
        isWithinRoot(folderPath, options.productionDir);
    return { folderPath, allowed, exists: fs.existsSync(folderPath) };
}

export async function openInCode(folderPath: string) {
    await execFileAsync("code", ["."], { cwd: folderPath, timeout: 10_000 });
}
