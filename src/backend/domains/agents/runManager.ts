type StreamMessage = {
    type?: string;
    error?: string;
    threadId?: string | null;
    text?: string;
    eventType?: string;
};

type AgentRunStatus = "queued" | "running" | "succeeded" | "failed";

type AgentRunKind = "execute" | "resume";

type AgentRunSummary = {
    id: string;
    kind: AgentRunKind;
    status: AgentRunStatus;
    taskId: string | null;
    projectId: string | null;
    worktreePath: string | null;
    threadId: string | null;
    lastMessage: string | null;
    lastEvent: string | null;
    error: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
};

type AgentRunRecord = AgentRunSummary;

function parseStreamEvents(input: string) {
    const dataLines = input
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .filter(Boolean);
    if (!dataLines.length) {
        return null;
    }
    return JSON.parse(dataLines.join("\n")) as StreamMessage;
}

async function consumeStream(response: Response, onMessage: (payload: StreamMessage) => void) {
    if (!response.body) {
        throw new Error("Server did not return a streaming response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processBufferedEvents = () => {
        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            const payload = parseStreamEvents(rawEvent);
            if (payload) {
                onMessage(payload);
            }
            if (payload?.type === "error") {
                throw new Error(payload.error || "Codex run failed.");
            }
            boundaryIndex = buffer.indexOf("\n\n");
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        processBufferedEvents();
    }

    buffer += decoder.decode();
    processBufferedEvents();
}

function nowIso() {
    return new Date().toISOString();
}

function sortByNewestCreatedAt(a: AgentRunRecord, b: AgentRunRecord) {
    return b.createdAt.localeCompare(a.createdAt);
}

export function createAgentRunManager() {
    // Keep run state in memory for now: active agent runs are process-bound today,
    // so persisting metadata without durable/recoverable execution would be misleading.
    const runs = new Map<string, AgentRunRecord>();

    const persist = (run: AgentRunRecord) => {
        runs.set(run.id, run);
    };

    const enqueue = (input: {
        kind: AgentRunKind;
        response: Response;
        taskId?: string | null;
        projectId?: string | null;
        worktreePath?: string | null;
        threadId?: string | null;
    }) => {
        const runId = crypto.randomUUID();
        const run: AgentRunRecord = {
            id: runId,
            kind: input.kind,
            status: "queued",
            taskId: input.taskId ?? null,
            projectId: input.projectId ?? null,
            worktreePath: input.worktreePath ?? null,
            threadId: input.threadId ?? null,
            lastMessage: null,
            lastEvent: null,
            error: null,
            createdAt: nowIso(),
            startedAt: null,
            finishedAt: null,
        };
        persist(run);
        console.info("[agent-runs] queued", {
            runId,
            kind: run.kind,
            taskId: run.taskId,
            projectId: run.projectId,
            worktreePath: run.worktreePath,
            threadId: run.threadId,
        });

        void (async () => {
            run.status = "running";
            run.startedAt = nowIso();
            persist(run);
            console.info("[agent-runs] started", { runId });

            try {
                await consumeStream(input.response, (payload) => {
                    if (payload.type === "thread" && typeof payload.threadId === "string") {
                        run.threadId = payload.threadId;
                    }
                    if (payload.type === "agent_message" && typeof payload.text === "string") {
                        run.lastMessage = payload.text;
                    }
                    if (payload.type === "item" && typeof payload.eventType === "string") {
                        run.lastEvent = payload.eventType;
                    }
                    if (payload.type === "error" && typeof payload.error === "string") {
                        run.lastEvent = "error";
                    }
                    persist(run);
                });
                run.status = "succeeded";
                run.finishedAt = nowIso();
                persist(run);
                console.info("[agent-runs] completed", { runId });
            } catch (error) {
                run.status = "failed";
                run.finishedAt = nowIso();
                run.error = error instanceof Error ? error.message : "Unexpected run error.";
                persist(run);
                console.warn("[agent-runs] failed", {
                    runId,
                    error: run.error,
                });
            }
        })();

        return runId;
    };

    const list = (input?: { projectId?: string | null }) => {
        const projectId = input?.projectId ?? null;
        return [...runs.values()]
            .filter((run) => (projectId ? run.projectId === projectId : true))
            .sort(sortByNewestCreatedAt);
    };

    const listWorktreeStatuses = (input?: { projectId?: string | null }) => {
        const projectId = input?.projectId ?? null;
        const byWorktreePath: Record<
            string,
            {
                runId: string;
                status: AgentRunStatus;
                threadId: string | null;
                lastMessage: string | null;
                lastEvent: string | null;
            }
        > = {};

        const sortedRuns = [...runs.values()].sort(sortByNewestCreatedAt);

        for (const run of sortedRuns) {
            if (!run.worktreePath) {
                continue;
            }
            if (projectId && run.projectId !== projectId) {
                continue;
            }

            const existing = byWorktreePath[run.worktreePath];
            if (!existing) {
                byWorktreePath[run.worktreePath] = {
                    runId: run.id,
                    status: run.status,
                    threadId: run.threadId,
                    lastMessage: run.lastMessage,
                    lastEvent: run.lastEvent,
                };
                continue;
            }

            // Keep the latest run status, but backfill missing thread metadata from prior runs.
            if (!existing.threadId && run.threadId) {
                existing.threadId = run.threadId;
            }
            if (!existing.lastMessage && run.lastMessage) {
                existing.lastMessage = run.lastMessage;
            }
            if (!existing.lastEvent && run.lastEvent) {
                existing.lastEvent = run.lastEvent;
            }
        }

        return byWorktreePath;
    };

    return {
        enqueue,
        list,
        listWorktreeStatuses,
    };
}
