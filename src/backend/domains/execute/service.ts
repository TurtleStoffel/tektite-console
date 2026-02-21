import { Result } from "typescript-result";
import { streamAgentRun } from "@/backend/domains/agents/service";
import { prepareWorktree } from "@/backend/domains/git/service";
import { tasksService } from "@/backend/domains/tasks/service";
import { ensureDirectoryExists } from "@/backend/filesystem";
import { summarizeWorktreePromptWithLmStudio } from "../../lmstudio";
import * as repository from "./repository";

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
    const streamRun = streamAgentRun;
    console.info("[execute] configured runner", {
        nodeEnv: process.env.NODE_ENV ?? null,
        runner: process.env.NODE_ENV === "development" ? "opencode" : "codex",
    });

    const execute = async (input: { prompt: string; repositoryUrl: string }) => {
        const preparedResult = await Result.try(
            async () => {
                await ensureDirectoryExists(clonesDir);
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
        try {
            const promptSummary = await summarizeWorktreePromptWithLmStudio(input.prompt);
            await repository.upsertWorktreePromptSummary({
                worktreePath: preparedResult.value.worktreePath,
                promptSummary,
            });
            console.info("[execute] saved worktree prompt summary", {
                workingDirectory: preparedResult.value.worktreePath,
            });
        } catch (error) {
            console.warn("[execute] failed to generate worktree prompt summary", {
                workingDirectory: preparedResult.value.worktreePath,
                error,
            });
        }

        const streamResult = Result.try(
            () =>
                streamRun({
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
    };

    return {
        async executeWithTaskHistory(input: {
            prompt: string;
            projectId?: string | null;
            repositoryUrl: string;
        }) {
            const createTaskResult = await tasksService.createTaskHistory({
                prompt: input.prompt,
                projectId: input.projectId,
            });
            if ("error" in createTaskResult) {
                return { error: createTaskResult.error, status: createTaskResult.status };
            }
            return execute({ prompt: input.prompt, repositoryUrl: input.repositoryUrl });
        },
        async execute(input: { prompt: string; repositoryUrl: string }) {
            return execute(input);
        },
        executeThreadComment(input: {
            comment: string;
            workingDirectory: string;
            threadId: string;
        }) {
            const streamResult = Result.try(
                () =>
                    streamRun({
                        prompt: input.comment,
                        workingDirectory: input.workingDirectory,
                        threadId: input.threadId,
                        clonesDir,
                    }),
                (error) => {
                    console.warn("[execute] failed to initialize thread comment stream", {
                        workingDirectory: input.workingDirectory,
                        threadId: input.threadId,
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
