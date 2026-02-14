import { useEffect, useRef, useState } from "react";

type StreamMessage = { type: "error"; error?: string } | { type: string };

type CommandPanelProps = {
    selectedRepoUrl: string | null;
};

export function CommandPanel({ selectedRepoUrl }: CommandPanelProps) {
    const [commandInput, setCommandInput] = useState("");
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [activeRuns, setActiveRuns] = useState(0);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const abortControllersRef = useRef<Set<AbortController>>(new Set());

    useEffect(() => {
        return () => {
            for (const controller of abortControllersRef.current) {
                controller.abort();
            }
            abortControllersRef.current.clear();
        };
    }, []);

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
        setActiveRuns((count) => count + 1);
        setStatusMessage("Preparing workspace and starting Codex...");

        const abortController = new AbortController();
        abortControllersRef.current.add(abortController);
        console.log(`[command-panel] starting run for ${selectedRepoUrl}`);

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
            let sawDone = false;

            setStatusMessage("Codex is running. Logs appear under the created worktree.");

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

                if (payload.type === "done") {
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

            if (!abortController.signal.aborted && !sawDone && buffer.trim().length > 0) {
                setStatusMessage("Connection closed before Codex finished.");
                return;
            }

            setStatusMessage("Codex run completed. Check the worktree card below for logs.");
            console.log("[command-panel] finished run");
        } catch (error) {
            if (abortController.signal.aborted) {
                setStatusMessage("Execution cancelled.");
                return;
            }
            const message =
                error instanceof Error ? error.message : "Unexpected error while executing.";
            setStatusMessage(`Error: ${message}`);
            console.warn("[command-panel] run failed", error);
        } finally {
            abortControllersRef.current.delete(abortController);
            setActiveRuns((count) => Math.max(0, count - 1));
        }
    };

    const canExecute = Boolean(commandInput.trim()) && Boolean(selectedRepoUrl);
    const running = activeRuns > 0;

    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Tasks Executor</h2>
                <p className="text-sm text-base-content/70">
                    Enter a command to execute in a new worktree.
                </p>
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
                        type="button"
                        onClick={handleExecute}
                        disabled={!canExecute}
                    >
                        {running ? "Running..." : "Execute"}
                    </button>
                    {running && (
                        <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => {
                                for (const controller of abortControllersRef.current) {
                                    controller.abort();
                                }
                                abortControllersRef.current.clear();
                            }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
                {validationMessage && (
                    <p className="text-sm text-base-content/70">{validationMessage}</p>
                )}
                {statusMessage && <p className="text-sm text-base-content/70">{statusMessage}</p>}
            </div>
        </>
    );
}

export default CommandPanel;
