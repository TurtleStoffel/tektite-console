import { useEffect, useRef, useState } from "react";
import { subscribeSelectedRepo } from "./events";

type StreamMessage =
    | { type: "agent_message"; text?: string }
    | { type: "error"; error?: string }
    | { type: "done"; response?: string }
    | { type: "usage"; usage?: unknown }
    | { type: "thread"; threadId?: string | null }
    | { type: "item"; eventType: string; item: unknown };

export function CommandPanel() {
    const [commandInput, setCommandInput] = useState("");
    const [executionMessage, setExecutionMessage] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return subscribeSelectedRepo(({ url }) => setSelectedRepoUrl(url));
    }, []);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const handleExecute = async () => {
        const trimmedCommand = commandInput.trim();
        if (!trimmedCommand) {
            setExecutionMessage("Enter a command before executing.");
            return;
        }

        if (!selectedRepoUrl) {
            setExecutionMessage("Select a repository before executing.");
            return;
        }

        setIsExecuting(true);
        setExecutionMessage("Preparing workspace and starting Codex…");

        abortControllerRef.current?.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

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
                const errorBody = await res.json().catch(() => ({}));
                const message = errorBody?.error || `Execution failed with status ${res.status}`;
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

                if (payload.type === "agent_message" && typeof payload.text === "string") {
                    latestMessage = payload.text;
                    setExecutionMessage(latestMessage);
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
                setExecutionMessage(latestMessage || "Connection closed before Codex finished.");
                return;
            }

            setExecutionMessage(latestMessage || "Codex run completed.");
        } catch (error) {
            if (abortController.signal.aborted) {
                setExecutionMessage("Execution cancelled.");
                return;
            }
            const message = error instanceof Error ? error.message : "Unexpected error while executing.";
            setExecutionMessage(`Error: ${message}`);
        } finally {
            setIsExecuting(false);
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    };

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
                        <a href={selectedRepoUrl} className="link link-hover break-all" target="_blank" rel="noreferrer">
                            {selectedRepoUrl}
                        </a>
                    ) : (
                        <span className="text-base-content/60">Open a project to select a repository to run Codex.</span>
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
                    <button className="btn btn-primary" onClick={handleExecute} disabled={isExecuting}>
                        {isExecuting ? "Executing…" : "Execute"}
                    </button>
                    {isExecuting && (
                        <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => {
                                abortControllerRef.current?.abort();
                                setExecutionMessage("Cancelling…");
                            }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
                {executionMessage && <p className="text-sm text-base-content/70">{executionMessage}</p>}
            </div>
        </>
    );
}

export default CommandPanel;
