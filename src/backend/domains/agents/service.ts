import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import { Result } from "typescript-result";
import { streamCodexRun } from "./codex";
import { streamOpenCodeRun } from "./opencode";

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

export function streamAgentRun(input: {
    prompt: string;
    workingDirectory: string;
    threadId?: string | null;
    clonesDir: string;
}) {
    const streamRun = process.env.NODE_ENV === "development" ? streamOpenCodeRun : streamCodexRun;
    return streamRun(input);
}

export function createAgentsService() {
    return {
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
