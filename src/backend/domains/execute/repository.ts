import { Result } from "typescript-result";
import { streamCodexRun } from "../../codex";
import { ensureClonesDir, prepareWorktree } from "../../git";

export class ExecutePrepareError extends Error {
    readonly type = "execute-prepare-error";

    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ExecutePrepareError";
    }
}

export class ExecuteStreamError extends Error {
    readonly type = "execute-stream-error";

    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ExecuteStreamError";
    }
}

export type ExecuteRepositoryError = ExecutePrepareError | ExecuteStreamError;

export function prepare(clonesDir: string, repositoryUrl: string) {
    return Result.try(
        async () => {
            await ensureClonesDir(clonesDir);
            return prepareWorktree(repositoryUrl, clonesDir);
        },
        (error) => {
            console.warn("[execute] failed to prepare worktree", { repositoryUrl, error });
            return new ExecutePrepareError("Failed to prepare repository for execution.", {
                cause: error,
            });
        },
    );
}

export function stream(clonesDir: string, prompt: string, workingDirectory: string) {
    return Result.try(
        () =>
            streamCodexRun({
                prompt,
                workingDirectory,
                clonesDir,
            }),
        (error) => {
            console.warn("[execute] failed to initialize execution stream", {
                workingDirectory,
                error,
            });
            return new ExecuteStreamError("Failed to start execution stream.", { cause: error });
        },
    );
}
