import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import { Result } from "typescript-result";
import { prepareWorktree } from "@/backend/domains/git/service";
import { tasksService } from "@/backend/domains/tasks/service";
import { ensureDirectoryExists } from "@/backend/filesystem";
import { summarizeWorktreePromptWithLmStudio } from "../../lmstudio";
import { streamCodexRun } from "./codex";
import { readThreadMap } from "./executionState";
import { streamOpenCodeRun } from "./opencode";
import * as repository from "./repository";

type CodexThreadSummary = {
    id: string;
    path: string;
    relativePath: string;
    sizeBytes: number;
    updatedAt: string;
};

type CodexThreadAnalysis = {
    markdown: string;
};

type WorktreeThreadMetadata = {
    threadId: string;
    lastMessage?: string;
    lastEvent?: string;
};

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

type CodexThreadServiceError =
    | {
          type: "codex-home-missing";
          message: string;
      }
    | {
          type: "thread-not-found";
          message: string;
      }
    | {
          type: "thread-too-large";
          message: string;
      }
    | {
          type: "thread-read-failed";
          message: string;
          cause?: unknown;
      }
    | {
          type: "analysis-failed";
          message: string;
          cause?: unknown;
      };

const codexClient = new Codex();
const MAX_THREAD_FILE_SIZE_BYTES = 2_000_000;

const DEFAULT_THREAD_OPTIONS = {
    approvalPolicy: "never" as const,
    networkAccessEnabled: true,
    sandboxMode: "workspace-write" as const,
    skipGitRepoCheck: true,
};

function resolveCodexHome(): Result<string, CodexThreadServiceError> {
    const home = Bun.env.HOME ?? os.homedir();
    if (!home) {
        return Result.error({
            type: "codex-home-missing",
            message: "Unable to resolve HOME directory for .codex lookup.",
        });
    }

    return Result.ok(path.resolve(home, ".codex"));
}

async function walkFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith(".")) {
            continue;
        }
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const nestedFiles = await walkFiles(entryPath);
            files.push(...nestedFiles);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        files.push(entryPath);
    }

    return files;
}

function isPathWithin(parentPath: string, targetPath: string): boolean {
    const relativePath = path.relative(parentPath, targetPath);
    return (
        relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
    );
}

function extractAgentMarkdown(events: ThreadEvent[]): string {
    const chunks: string[] = [];
    for (const event of events) {
        if (
            (event.type === "item.started" ||
                event.type === "item.updated" ||
                event.type === "item.completed") &&
            event.item?.type === "agent_message" &&
            typeof event.item.text === "string"
        ) {
            chunks.push(event.item.text.trim());
        }
    }

    if (chunks.length === 0) {
        return "# Analysis\n\nNo analysis was produced by Codex.";
    }

    return chunks[chunks.length - 1] ?? "# Analysis\n\nNo analysis was produced by Codex.";
}

async function runAnalysisPrompt(input: { threadContent: string }): Promise<string> {
    const cwd = process.cwd();
    const thread = codexClient.startThread({
        ...DEFAULT_THREAD_OPTIONS,
        workingDirectory: cwd,
    });

    const prompt = [
        "Analyze this Codex thread JSONL log and produce markdown.",
        "Focus on the most expensive steps by token usage.",
        "Requirements:",
        "1. Title the document 'Codex Thread Token Analysis'.",
        "2. Include a section called 'Most Expensive Steps'.",
        "3. Rank the top 5 most expensive steps, including token counts when available.",
        "4. Add a short section called 'Observations' with concise takeaways.",
        "5. If usage data is missing for a step, state that explicitly.",
        "",
        "Thread content:",
        input.threadContent,
    ].join("\n");

    const { events } = await thread.runStreamed(prompt);
    const collectedEvents: ThreadEvent[] = [];

    for await (const event of events as AsyncGenerator<ThreadEvent>) {
        collectedEvents.push(event);
    }

    return extractAgentMarkdown(collectedEvents);
}

function streamAgentRun(input: {
    prompt: string;
    workingDirectory: string;
    threadId?: string | null;
    clonesDir: string;
}) {
    const streamRun = process.env.NODE_ENV === "development" ? streamOpenCodeRun : streamCodexRun;
    return streamRun(input);
}

export function createAgentsService(options: { clonesDir: string }) {
    const { clonesDir } = options;
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
                streamAgentRun({
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
        async executeWithTask(input: {
            prompt: string;
            projectId?: string | null;
            repositoryUrl: string;
        }) {
            const createTaskResult = await tasksService.createTask({
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

        getWorktreeThreadMetadata(input: { worktreePaths: string[] }) {
            const threadMap = readThreadMap(clonesDir);
            const metadataByWorktreePath: Record<string, WorktreeThreadMetadata> = {};
            for (const worktreePath of input.worktreePaths) {
                const thread = threadMap[worktreePath];
                if (!thread) {
                    continue;
                }
                metadataByWorktreePath[worktreePath] = {
                    threadId: thread.threadId,
                    lastMessage: thread.lastMessage,
                    lastEvent: thread.lastEvent,
                };
            }

            console.info("[agents] resolved worktree thread metadata", {
                requestedWorktrees: input.worktreePaths.length,
                foundWorktrees: Object.keys(metadataByWorktreePath).length,
            });

            return metadataByWorktreePath;
        },

        executeThreadComment(input: {
            comment: string;
            workingDirectory: string;
            threadId: string;
        }) {
            const streamResult = Result.try(
                () =>
                    streamAgentRun({
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

        async listThreads() {
            const codexHomeResult = resolveCodexHome();
            if (!codexHomeResult.ok) {
                return Result.error(codexHomeResult.error);
            }

            const sessionsDir = path.join(codexHomeResult.value, "sessions");
            const filePathsResult = await Result.try(
                () => walkFiles(sessionsDir),
                (error) =>
                    ({
                        type: "thread-read-failed",
                        message: "Failed to read Codex sessions directory.",
                        cause: error,
                    }) as const,
            );
            if (!filePathsResult.ok) {
                return Result.error(filePathsResult.error);
            }

            const threadFilePaths = filePathsResult.value.filter((filePath) =>
                filePath.endsWith(".jsonl"),
            );

            const statResults = await Promise.all(
                threadFilePaths.map(async (filePath) => {
                    const metadata = await stat(filePath);
                    return {
                        id: path.basename(filePath, ".jsonl"),
                        path: filePath,
                        relativePath: path.relative(codexHomeResult.value, filePath),
                        sizeBytes: metadata.size,
                        updatedAt: metadata.mtime.toISOString(),
                    } satisfies CodexThreadSummary;
                }),
            );

            statResults.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

            console.info("[codex-threads] listed thread files", {
                count: statResults.length,
                codexHome: codexHomeResult.value,
            });

            return Result.ok(statResults);
        },

        async analyzeThread(input: { threadPath: string }) {
            const codexHomeResult = resolveCodexHome();
            if (!codexHomeResult.ok) {
                return Result.error(codexHomeResult.error);
            }

            const resolvedThreadPath = path.resolve(input.threadPath);
            if (!isPathWithin(codexHomeResult.value, resolvedThreadPath)) {
                return Result.error({
                    type: "thread-not-found",
                    message: "Thread path must be within ~/.codex.",
                });
            }

            const fileStatResult = await Result.try(
                () => stat(resolvedThreadPath),
                (error) =>
                    ({
                        type: "thread-not-found",
                        message: "Selected thread file was not found.",
                        cause: error,
                    }) as const,
            );
            if (!fileStatResult.ok) {
                return Result.error(fileStatResult.error);
            }

            if (!fileStatResult.value.isFile()) {
                return Result.error({
                    type: "thread-not-found",
                    message: "Selected thread path is not a file.",
                });
            }

            if (fileStatResult.value.size > MAX_THREAD_FILE_SIZE_BYTES) {
                return Result.error({
                    type: "thread-too-large",
                    message: `Thread file exceeds ${MAX_THREAD_FILE_SIZE_BYTES} bytes.`,
                });
            }

            const threadContentResult = await Result.try(
                () => readFile(resolvedThreadPath, "utf8"),
                (error) =>
                    ({
                        type: "thread-read-failed",
                        message: "Failed to read selected thread file.",
                        cause: error,
                    }) as const,
            );
            if (!threadContentResult.ok) {
                return Result.error(threadContentResult.error);
            }

            const markdownResult = await Result.try(
                () => runAnalysisPrompt({ threadContent: threadContentResult.value }),
                (error) =>
                    ({
                        type: "analysis-failed",
                        message: "Failed to analyze selected thread with Codex.",
                        cause: error,
                    }) as const,
            );
            if (!markdownResult.ok) {
                return Result.error(markdownResult.error);
            }

            const response: CodexThreadAnalysis = {
                markdown: markdownResult.value,
            };

            console.info("[codex-threads] analyzed thread file", {
                threadPath: resolvedThreadPath,
                sizeBytes: fileStatResult.value.size,
            });

            return Result.ok(response);
        },
    };
}
