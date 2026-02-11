import fs from "node:fs";
import path from "node:path";
import {
    Codex,
    type Thread,
    type ThreadEvent,
    type ThreadItem,
    type Usage,
} from "@openai/codex-sdk";
import { finalizeGitState } from "./git";
import { markWorkspaceActive, markWorkspaceInactive } from "./workspaceActivity";

type StreamChunk =
    | { type: "thread"; threadId: string | null }
    | { type: "item"; eventType: ThreadEvent["type"]; item: ThreadItem }
    | { type: "agent_message"; text: string }
    | { type: "usage"; usage: Usage }
    | { type: "done"; threadId: string | null; response: string; usage: Usage | null }
    | { type: "error"; error: string };

const DEFAULT_THREAD_OPTIONS = {
    approvalPolicy: "never" as const,
    sandboxMode: "workspace-write" as const,
    skipGitRepoCheck: true,
};

const codexClient = new Codex();
const encoder = new TextEncoder();
const COMMIT_AND_PR_INSTRUCTION =
    "Before finishing, write your desired commit message into commit-details.txt";
const WORKTREE_THREADS_FILENAME = "worktree-threads.json";

export type ThreadMetadata = {
    threadId: string;
    lastMessage?: string;
    lastEvent?: string;
};

function threadMapPath(clonesDir: string) {
    return path.join(clonesDir, WORKTREE_THREADS_FILENAME);
}

export function readThreadMap(clonesDir: string): Record<string, ThreadMetadata> {
    try {
        const mapPath = threadMapPath(clonesDir);
        if (!fs.existsSync(mapPath)) {
            return {};
        }

        const raw = fs.readFileSync(mapPath, "utf8").trim();
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return {};
        }

        const entries = Object.entries(parsed)
            .map(([key, value]) => {
                if (typeof value === "string") {
                    return [key, { threadId: value } satisfies ThreadMetadata] as const;
                }

                if (
                    value &&
                    typeof value === "object" &&
                    typeof (value as { threadId?: unknown }).threadId === "string"
                ) {
                    const threadId = (value as { threadId: string }).threadId;
                    const lastMessage =
                        typeof (value as { lastMessage?: unknown }).lastMessage === "string"
                            ? (value as { lastMessage: string }).lastMessage
                            : undefined;
                    const lastEvent =
                        typeof (value as { lastEvent?: unknown }).lastEvent === "string"
                            ? (value as { lastEvent: string }).lastEvent
                            : undefined;
                    return [
                        key,
                        { threadId, lastMessage, lastEvent } satisfies ThreadMetadata,
                    ] as const;
                }

                return null;
            })
            .filter((entry): entry is [string, ThreadMetadata] => Boolean(entry));

        return Object.fromEntries(entries) as Record<string, ThreadMetadata>;
    } catch (error) {
        console.warn("Failed to read thread map", error);
        return {};
    }
}

function writeThreadMap(clonesDir: string, map: Record<string, ThreadMetadata>) {
    try {
        const mapPath = threadMapPath(clonesDir);
        fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
    } catch (error) {
        console.warn("Failed to write thread map", error);
    }
}

function recordThreadId(clonesDir: string, worktreePath: string, threadId?: string | null) {
    if (!worktreePath || !threadId) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (existing?.threadId === threadId) {
        return;
    }

    threadMap[worktreePath] = {
        threadId,
        lastMessage: existing?.lastMessage,
        lastEvent: existing?.lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

function recordLastMessage(clonesDir: string, worktreePath: string, lastMessage?: string | null) {
    if (!worktreePath || !lastMessage) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (!existing?.threadId) {
        return;
    }

    if (existing.lastMessage === lastMessage) {
        return;
    }

    threadMap[worktreePath] = {
        threadId: existing.threadId,
        lastMessage,
        lastEvent: existing.lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

function recordLastEvent(clonesDir: string, worktreePath: string, lastEvent?: string | null) {
    if (!worktreePath || !lastEvent) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (!existing?.threadId) {
        return;
    }

    if (existing.lastEvent === lastEvent) {
        return;
    }

    threadMap[worktreePath] = {
        threadId: existing.threadId,
        lastMessage: existing.lastMessage,
        lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

function appendCommitInstruction(prompt: string) {
    return `${prompt}\n\n${COMMIT_AND_PR_INSTRUCTION}`;
}

function summarizeThreadEvent(event: ThreadEvent) {
    const summary: string[] = [`type=${event.type}`];

    if (
        (event.type === "item.started" ||
            event.type === "item.updated" ||
            event.type === "item.completed") &&
        event.item
    ) {
        summary.push(`item=${event.item.type}`);
        if ("status" in event.item && typeof event.item.status === "string") {
            summary.push(`status=${event.item.status}`);
        }

        if (event.item.type === "agent_message" && typeof event.item.text === "string") {
            const preview = event.item.text.replace(/\s+/g, " ").trim();
            const truncated = preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
            summary.push(`text="${truncated}"`);
        }
    }

    if (event.type === "turn.failed") {
        summary.push(`error=${event.error?.message ?? "unknown error"}`);
    }

    if (event.type === "turn.completed") {
        const usage = event.usage
            ? `i=${event.usage.input_tokens ?? "?"}/o=${event.usage.output_tokens ?? "?"}`
            : "usage=none";
        summary.push(usage);
    }

    return summary.join(" | ");
}

function mapEventChunk(
    event: ThreadEvent,
    latest: { text: string; usage: Usage | null },
    send: (chunk: StreamChunk) => void,
) {
    if (event.type === "thread.started") {
        send({ type: "thread", threadId: event.thread_id });
        return;
    }

    if (
        (event.type === "item.started" ||
            event.type === "item.updated" ||
            event.type === "item.completed") &&
        event.item
    ) {
        send({ type: "item", eventType: event.type, item: event.item });
        if (event.item.type === "agent_message" && typeof event.item.text === "string") {
            latest.text = event.item.text;
            send({ type: "agent_message", text: latest.text });
        }
        return;
    }

    if (event.type === "turn.completed") {
        latest.usage = event.usage ?? null;
        send({ type: "usage", usage: latest.usage });
        return;
    }

    if (event.type === "turn.failed") {
        const message = event.error?.message ?? "Codex turn failed";
        send({ type: "error", error: message });
        return;
    }

    if (event.type === "error") {
        const message = event.message ?? "Stream error";
        send({ type: "error", error: message });
    }
}

function startThread(workingDirectory: string, threadId?: string | null): Thread {
    if (threadId) {
        try {
            const thread = codexClient.resumeThread(threadId, {
                ...DEFAULT_THREAD_OPTIONS,
                workingDirectory,
            });
            // eslint-disable-next-line no-console
            console.log(`[codex] Reusing thread ${threadId}`);
            return thread;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`[codex] Failed to resume thread ${threadId}; starting new thread`, error);
        }
    }

    return codexClient.startThread({
        ...DEFAULT_THREAD_OPTIONS,
        workingDirectory,
    });
}

export function streamCodexRun(options: {
    prompt: string;
    workingDirectory: string;
    threadId?: string | null;
    clonesDir: string;
}) {
    const { prompt, workingDirectory, threadId, clonesDir } = options;
    const augmentedPrompt = appendCommitInstruction(prompt);
    const threadMap = readThreadMap(clonesDir);
    const mappedThreadId = threadId ?? threadMap[workingDirectory]?.threadId ?? null;
    const thread = startThread(workingDirectory, mappedThreadId);

    let cancelled = false;
    let _controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

    const stream = new ReadableStream({
        start: async (controller) => {
            _controllerRef = controller;
            markWorkspaceActive(workingDirectory);

            const send = (chunk: StreamChunk) => {
                if (cancelled) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                } catch {
                    cancelled = true;
                }
            };

            const latest = { text: "", usage: null as Usage | null };

            const closeStream = () => {
                if (!cancelled) {
                    cancelled = true;
                    controller.close();
                }
            };

            try {
                // eslint-disable-next-line no-console
                console.log("[codex] stream starting");
                const { events } = await thread.runStreamed(augmentedPrompt);

                for await (const event of events as AsyncGenerator<ThreadEvent>) {
                    if (cancelled) break;
                    const summary = summarizeThreadEvent(event);
                    // eslint-disable-next-line no-console
                    console.log("[codex] event:", summary);
                    mapEventChunk(event, latest, send);

                    if (event.type === "thread.started") {
                        recordThreadId(clonesDir, workingDirectory, event.thread_id);
                    }

                    if (
                        event.type === "item.started" ||
                        event.type === "item.updated" ||
                        event.type === "item.completed"
                    ) {
                        recordLastEvent(clonesDir, workingDirectory, summary);
                        if (
                            event.item?.type === "agent_message" &&
                            typeof event.item.text === "string"
                        ) {
                            recordLastMessage(clonesDir, workingDirectory, event.item.text);
                        }
                    }

                    if (
                        event.type === "turn.completed" ||
                        event.type === "turn.failed" ||
                        event.type === "error"
                    ) {
                        recordLastEvent(clonesDir, workingDirectory, summary);
                    }
                }

                if (!cancelled) {
                    send({
                        type: "done",
                        threadId: thread.id ?? null,
                        response: latest.text,
                        usage: latest.usage,
                    });
                    recordThreadId(clonesDir, workingDirectory, thread.id ?? null);
                    recordLastMessage(clonesDir, workingDirectory, latest.text);
                    await finalizeGitState(workingDirectory);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unexpected Codex error";
                send({ type: "error", error: message });
            } finally {
                closeStream();
                _controllerRef = null;
                markWorkspaceInactive(workingDirectory);
            }
        },
        cancel: () => {
            cancelled = true;
            _controllerRef = null;
            // eslint-disable-next-line no-console
            console.log("[codex] stream cancelled by client");
            markWorkspaceInactive(workingDirectory);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
