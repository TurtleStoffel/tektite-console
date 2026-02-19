import {
    createOpencodeClient,
    type Part as OpenCodePart,
    type Session as OpenCodeSession,
} from "@opencode-ai/sdk";
import {
    markCodexWorkspaceActive,
    markCodexWorkspaceInactive,
} from "./domains/worktrees/workspaceActivity";
import {
    appendCommitInstruction,
    readThreadMap,
    recordLastEvent,
    recordLastMessage,
    recordThreadId,
} from "./executionState";
import { finalizeGitState } from "./git";

type StreamUsage = {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
};

type StreamChunk =
    | { type: "thread"; threadId: string | null }
    | { type: "agent_message"; text: string }
    | { type: "usage"; usage: StreamUsage }
    | { type: "done"; threadId: string | null; response: string; usage: StreamUsage | null }
    | { type: "error"; error: string };

const DEFAULT_OPENCODE_BASE_URL = "http://localhost:4096";
const encoder = new TextEncoder();

function resolveOpenCodeBaseUrl() {
    return process.env.OPENCODE_BASE_URL?.trim() || DEFAULT_OPENCODE_BASE_URL;
}

function getTextFromOpenCodeParts(parts: OpenCodePart[] | undefined) {
    if (!parts) return "";
    return parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
}

async function resolveOpenCodeSession(
    workingDirectory: string,
    mappedThreadId?: string | null,
): Promise<{ client: ReturnType<typeof createOpencodeClient>; session: OpenCodeSession }> {
    const client = createOpencodeClient({
        baseUrl: resolveOpenCodeBaseUrl(),
        directory: workingDirectory,
    });

    if (mappedThreadId) {
        const { data: resumed } = await client.session.get({
            path: { id: mappedThreadId },
        });
        if (resumed) {
            return { client, session: resumed };
        }
        console.warn(
            `[opencode] Failed to resume session ${mappedThreadId}; creating a new session`,
        );
    }

    const { data: createdSession } = await client.session.create();
    if (!createdSession) {
        throw new Error("OpenCode did not return a created session.");
    }

    return { client, session: createdSession };
}

export function streamOpenCodeRun(options: {
    prompt: string;
    workingDirectory: string;
    threadId?: string | null;
    clonesDir: string;
}) {
    const { prompt, workingDirectory, threadId, clonesDir } = options;
    const augmentedPrompt = appendCommitInstruction(prompt);
    const threadMap = readThreadMap(clonesDir);
    const mappedThreadId = threadId ?? threadMap[workingDirectory]?.threadId ?? null;

    let cancelled = false;
    const stream = new ReadableStream({
        start: async (controller) => {
            markCodexWorkspaceActive(workingDirectory);

            const send = (chunk: StreamChunk) => {
                if (cancelled) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                } catch {
                    cancelled = true;
                }
            };

            const latest = { text: "", usage: null as StreamUsage | null };

            const closeStream = () => {
                if (!cancelled) {
                    cancelled = true;
                    controller.close();
                }
            };

            try {
                const { client, session } = await resolveOpenCodeSession(
                    workingDirectory,
                    mappedThreadId,
                );
                const sessionId = session.id;
                send({ type: "thread", threadId: sessionId });

                const { data: promptResult } = await client.session.prompt({
                    path: { id: sessionId },
                    body: {
                        parts: [{ type: "text", text: augmentedPrompt }],
                    },
                });
                if (!promptResult) {
                    throw new Error("OpenCode did not return a prompt response.");
                }

                const usage: StreamUsage = {
                    input_tokens: promptResult.info.tokens.input,
                    cached_input_tokens: promptResult.info.tokens.cache.read,
                    output_tokens: promptResult.info.tokens.output,
                };
                latest.usage = usage;
                send({ type: "usage", usage });

                const finalText = getTextFromOpenCodeParts(promptResult.parts);
                if (finalText) {
                    latest.text = finalText;
                    send({ type: "agent_message", text: finalText });
                }

                send({
                    type: "done",
                    threadId: sessionId,
                    response: latest.text,
                    usage: latest.usage,
                });
                recordThreadId(clonesDir, workingDirectory, sessionId);
                recordLastMessage(clonesDir, workingDirectory, latest.text);
                recordLastEvent(
                    clonesDir,
                    workingDirectory,
                    "type=turn.completed | provider=opencode",
                );
                await finalizeGitState(workingDirectory);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Unexpected OpenCode error";
                send({ type: "error", error: message });
            } finally {
                closeStream();
                markCodexWorkspaceInactive(workingDirectory);
            }
        },
        cancel: () => {
            cancelled = true;
            markCodexWorkspaceInactive(workingDirectory);
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
