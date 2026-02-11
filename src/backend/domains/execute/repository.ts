import { streamCodexRun } from "../../codex";
import { ensureClonesDir, prepareWorktree } from "../../git";

export async function prepare(clonesDir: string, repositoryUrl: string) {
    await ensureClonesDir(clonesDir);
    return prepareWorktree(repositoryUrl, clonesDir);
}

export function stream(clonesDir: string, prompt: string, workingDirectory: string) {
    return streamCodexRun({
        prompt,
        workingDirectory,
        clonesDir,
    });
}
