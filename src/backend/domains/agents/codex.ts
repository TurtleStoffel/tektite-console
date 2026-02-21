import {
    Codex,
    type Thread,
    type ThreadEvent,
    type ThreadItem,
    type Usage,
} from "@openai/codex-sdk";
import {
    markAgentWorkspaceActive,
    markAgentWorkspaceInactive,
} from "@/backend/domains/worktrees/service";
import {
    appendCommitInstruction,
    readThreadMap,
    recordLastEvent,
    recordLastMessage,
    recordThreadId,
} from "../../executionState";
import { finalizeGitState } from "../../git";

type StreamChunk =
    | { type: "thread"; threadId: string | null }
    | { type: "item"; eventType: ThreadEvent["type"]; item: ThreadItem }
    | { type: "agent_message"; text: string }
    | { type: "usage"; usage: Usage }
    | { type: "done"; threadId: string | null; response: string; usage: Usage | null }
    | { type: "error"; error: string };

const DEFAULT_THREAD_OPTIONS = {
    approvalPolicy: "never" as const,
    networkAccessEnabled: true,
    sandboxMode: "workspace-write" as const,
    skipGitRepoCheck: true,
};

const codexClient = new Codex();
const encoder = new TextEncoder();

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
            return thread;
        } catch (error) {
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
            markAgentWorkspaceActive(workingDirectory);

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
                const { events } = await thread.runStreamed(augmentedPrompt);

                for await (const event of events as AsyncGenerator<ThreadEvent>) {
                    if (cancelled) break;
                    const summary = summarizeThreadEvent(event);
                    if (event.type === "item.completed" && event.item?.type === "agent_message") {
                        const eventThreadId =
                            "thread_id" in event && typeof event.thread_id === "string"
                                ? event.thread_id
                                : (thread.id ?? "unknown");
                        console.log(`[codex] threadId=${eventThreadId} | ${summary}`);
                    }
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
                markAgentWorkspaceInactive(workingDirectory);
            }
        },
        cancel: () => {
            cancelled = true;
            _controllerRef = null;
            markAgentWorkspaceInactive(workingDirectory);
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
