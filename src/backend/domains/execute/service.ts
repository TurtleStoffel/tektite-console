import { Result } from "typescript-result";
import { streamCodexRun } from "../../codex";
import { ensureClonesDir, prepareWorktree } from "../../git";

class ExecutePrepareError extends Error {
    readonly type = "execute-prepare-error";

    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ExecutePrepareError";
    }
}

class ExecuteStreamError extends Error {
    readonly type = "execute-stream-error";

    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ExecuteStreamError";
    }
}

export function createExecuteService(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        async execute(input: { prompt: string; repositoryUrl: string }) {
            const preparedResult = await Result.try(
                async () => {
                    await ensureClonesDir(clonesDir);
                    return prepareWorktree(input.repositoryUrl, clonesDir);
                },
                (error) => {
                    console.warn("[execute] failed to prepare worktree", {
                        repositoryUrl: input.repositoryUrl,
                        error,
                    });
                    return new ExecutePrepareError("Failed to prepare repository for execution.", {
                        cause: error,
                    });
                },
            );
            if (!preparedResult.ok) {
                return Result.error(preparedResult.error);
            }

            const streamResult = Result.try(
                () =>
                    streamCodexRun({
                        prompt: input.prompt,
                        workingDirectory: preparedResult.value.worktreePath,
                        clonesDir,
                    }),
                (error) => {
                    console.warn("[execute] failed to initialize execution stream", {
                        workingDirectory: preparedResult.value.worktreePath,
                        error,
                    });
                    return new ExecuteStreamError("Failed to start execution stream.", {
                        cause: error,
                    });
                },
            );
            if (!streamResult.ok) {
                return Result.error(streamResult.error);
            }

            return Result.ok(streamResult.value);
        },
    };
}
