import { useEffect, useRef, useState } from "react";
import { subscribeSelectedRepo } from "./events";

type StreamMessage =
    | { type: "agent_message"; text?: string }
    | { type: "error"; error?: string }
    | { type: "done"; response?: string }
    | { type: "usage"; usage?: unknown }
    | { type: "thread"; threadId?: string | null }
    | { type: "item"; eventType: string; item: unknown };

type RunStatus = "starting" | "running" | "done" | "error" | "cancelled";

type CommandRun = {
    id: string;
    command: string;
    repoUrl: string;
    status: RunStatus;
    message: string;
    threadId?: string | null;
    startedAt: number;
    finishedAt?: number;
};

function createRunStatusBadge(status: RunStatus) {
    const base = "badge badge-sm";

    if (status === "running" || status === "starting") {
        return `${base} badge-info`;
    }

    if (status === "done") {
        return `${base} badge-success`;
    }

    if (status === "cancelled") {
        return `${base} badge-ghost`;
    }

    return `${base} badge-error`;
}

export function CommandPanel() {
    const [commandInput, setCommandInput] = useState("");
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [runs, setRuns] = useState<CommandRun[]>([]);
    const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

    useEffect(() => {
        return subscribeSelectedRepo(({ url }) => setSelectedRepoUrl(url));
    }, []);

    useEffect(() => {
        return () => {
            for (const controller of abortControllersRef.current.values()) {
                controller.abort();
            }
            abortControllersRef.current.clear();
        };
    }, []);

    const updateRun = (runId: string, patch: Partial<CommandRun>) => {
        setRuns((prevRuns) =>
            prevRuns.map((run) => (run.id === runId ? { ...run, ...patch } : run)),
        );
    };

    const cancelRun = (runId: string) => {
        const controller = abortControllersRef.current.get(runId);
        if (!controller) return;
        controller.abort();
        updateRun(runId, {
            status: "cancelled",
            message: "Execution cancelled.",
            finishedAt: Date.now(),
        });
        console.log(`[command-panel] cancelled run ${runId}`);
    };

    const handleExecute = async () => {
        const trimmedCommand = commandInput.trim();
        if (!trimmedCommand) {
            setValidationMessage("Enter a command before executing.");
            return;
        }

        if (!selectedRepoUrl) {
            setValidationMessage("Select a repository before executing.");
            return;
        }

        setValidationMessage(null);

        const runId =
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const startedAt = Date.now();

        setRuns((prevRuns) => [
            {
                id: runId,
                command: trimmedCommand,
                repoUrl: selectedRepoUrl,
                status: "starting",
                message: "Preparing workspace and starting Codex…",
                startedAt,
            },
            ...prevRuns,
        ]);

        const abortController = new AbortController();
        abortControllersRef.current.set(runId, abortController);
        console.log(`[command-panel] starting run ${runId} for ${selectedRepoUrl}`);

        try {
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
                body: JSON.stringify({
                    prompt: trimmedCommand,
                    repository: { type: "git", url: selectedRepoUrl },
                }),
                signal: abortController.signal,
            });

            if (!res.ok) {
                const errorBody = await res.text();
                let message = `Execution failed with status ${res.status}`;
                if (errorBody.trim()) {
                    try {
                        const parsed = JSON.parse(errorBody) as unknown;
                        if (
                            parsed &&
                            typeof parsed === "object" &&
                            "error" in parsed &&
                            typeof (parsed as { error?: unknown }).error === "string"
                        ) {
                            message = (parsed as { error: string }).error;
                        } else {
                            message = errorBody;
                        }
                    } catch {
                        message = errorBody;
                    }
                }
                throw new Error(message);
            }

            if (!res.body) {
                throw new Error("Server did not return a streaming response.");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let latestMessage = "";
            let sawDone = false;

            updateRun(runId, { status: "running" });

            const processEvent = (rawEvent: string) => {
                const dataLines = rawEvent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith("data:"))
                    .map((line) => line.replace(/^data:\s?/, ""))
                    .filter(Boolean);

                if (!dataLines.length) return;

                const payload = JSON.parse(dataLines.join("\n")) as StreamMessage;

                if (payload.type === "error") {
                    throw new Error(payload.error || "Codex run failed.");
                }

                if (payload.type === "thread") {
                    if (typeof payload.threadId !== "undefined") {
                        updateRun(runId, { threadId: payload.threadId ?? null });
                    }
                    return;
                }

                if (payload.type === "agent_message" && typeof payload.text === "string") {
                    latestMessage = payload.text;
                    updateRun(runId, { message: latestMessage });
                }

                if (payload.type === "done" && typeof payload.response === "string") {
                    latestMessage = payload.response;
                    sawDone = true;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let boundaryIndex = buffer.indexOf("\n\n");

                while (boundaryIndex !== -1) {
                    const rawEvent = buffer.slice(0, boundaryIndex);
                    buffer = buffer.slice(boundaryIndex + 2);
                    processEvent(rawEvent);
                    boundaryIndex = buffer.indexOf("\n\n");
                }
            }

            buffer += decoder.decode();
            let boundaryIndex = buffer.indexOf("\n\n");
            while (boundaryIndex !== -1) {
                const rawEvent = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                processEvent(rawEvent);
                boundaryIndex = buffer.indexOf("\n\n");
            }

            if (!abortController.signal.aborted && !sawDone && buffer.trim()) {
                updateRun(runId, {
                    status: "error",
                    message: latestMessage || "Connection closed before Codex finished.",
                    finishedAt: Date.now(),
                });
                return;
            }

            updateRun(runId, {
                status: "done",
                message: latestMessage || "Codex run completed.",
                finishedAt: Date.now(),
            });
            console.log(`[command-panel] finished run ${runId}`);
        } catch (error) {
            if (abortController.signal.aborted) {
                updateRun(runId, {
                    status: "cancelled",
                    message: "Execution cancelled.",
                    finishedAt: Date.now(),
                });
                return;
            }
            const message =
                error instanceof Error ? error.message : "Unexpected error while executing.";
            updateRun(runId, {
                status: "error",
                message: `Error: ${message}`,
                finishedAt: Date.now(),
            });
            console.warn(`[command-panel] run ${runId} failed`, error);
        } finally {
            abortControllersRef.current.delete(runId);
        }
    };

    const runningCount = runs.filter(
        (run) => run.status === "running" || run.status === "starting",
    ).length;
    const canExecute = Boolean(commandInput.trim()) && Boolean(selectedRepoUrl);

    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Command drawer</h2>
                <p className="text-sm text-base-content/70">
                    Enter a command to execute or store alongside your selected repositories.
                </p>
                <div className="text-sm text-base-content/70">
                    <span className="font-semibold">Active repository:</span>{" "}
                    {selectedRepoUrl ? (
                        <a
                            href={selectedRepoUrl}
                            className="link link-hover break-all"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {selectedRepoUrl}
                        </a>
                    ) : (
                        <span className="text-base-content/60">
                            Open a project to select a repository to run Codex.
                        </span>
                    )}
                </div>
            </div>
            <div className="form-control gap-2">
                <textarea
                    placeholder="Enter command"
                    className="textarea textarea-bordered w-full min-h-[120px]"
                    value={commandInput}
                    onChange={(event) => setCommandInput(event.target.value)}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        className="btn btn-primary"
                        onClick={handleExecute}
                        disabled={!canExecute}
                    >
                        Execute{runningCount > 0 ? ` (${runningCount} running)` : ""}
                    </button>
                    {runs.length > 0 && (
                        <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => {
                                setRuns([]);
                                for (const controller of abortControllersRef.current.values()) {
                                    controller.abort();
                                }
                                abortControllersRef.current.clear();
                                setValidationMessage(null);
                                console.log("[command-panel] cleared all runs");
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
                {validationMessage && (
                    <p className="text-sm text-base-content/70">{validationMessage}</p>
                )}
                {runs.length > 0 && (
                    <div className="space-y-2">
                        {runs.map((run) => {
                            const isRunActive =
                                run.status === "starting" || run.status === "running";
                            return (
                                <div key={run.id} className="card card-compact bg-base-200/60">
                                    <div className="card-body">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={createRunStatusBadge(run.status)}
                                                    >
                                                        {run.status}
                                                    </span>
                                                    <span className="font-mono text-xs text-base-content/70 break-all">
                                                        {run.repoUrl}
                                                    </span>
                                                </div>
                                                <div className="font-mono text-sm break-words">
                                                    {run.command}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {run.threadId && (
                                                    <span className="font-mono text-xs text-base-content/60">
                                                        thread: {run.threadId}
                                                    </span>
                                                )}
                                                {isRunActive && (
                                                    <button
                                                        className="btn btn-xs btn-ghost"
                                                        type="button"
                                                        onClick={() => cancelRun(run.id)}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-base-content/70 whitespace-pre-wrap">
                                            {run.message}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

export default CommandPanel;
