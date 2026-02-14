import fs from "node:fs";
import path from "node:path";
import { isWithinRoot } from "../../http/pathUtils";

export function isWithinAnyRoot(roots: string[], worktreePath: string) {
    return roots.some((root) => isWithinRoot(worktreePath, root));
}

export function exists(worktreePath: string) {
    return fs.existsSync(worktreePath);
}

export function isGitRepository(worktreePath: string) {
    const gitPath = path.join(worktreePath, ".git");
    try {
        const stat = fs.lstatSync(gitPath);
        return stat.isDirectory() || stat.isFile();
    } catch {
        return false;
    }
}
