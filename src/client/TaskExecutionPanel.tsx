import { useEffect, useRef, useState } from "react";

type StreamMessage = { type: string; error?: string };

type TaskExecutionPanelProps = {
    projectId: string;
    onTaskStarted: () => void;
};

export default function TaskExecutionPanel({
    projectId,
    onTaskStarted = () => {},
}: TaskExecutionPanelProps) {
    const [taskPrompt, setTaskPrompt] = useState("");
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [activeRuns, setActiveRuns] = useState(0);
    const [creatingTask, setCreatingTask] = useState(false);
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
    const running = activeRuns > 0;

    const createTask = async (
        trimmedPrompt: string,
        signal: AbortSignal,
    ): Promise<{ id: string }> => {
        const createTaskRes = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: trimmedPrompt,
                projectId,
            }),
            signal,
        });
        const createTaskPayload = await createTaskRes.json().catch(() => ({}));
        if (!createTaskRes.ok) {
            throw new Error(
                typeof createTaskPayload?.error === "string"
                    ? createTaskPayload.error
                    : "Failed to create task.",
            );
        }
        if (typeof createTaskPayload?.id !== "string" || createTaskPayload.id.length === 0) {
            throw new Error("Task creation returned an invalid task id.");
        }
        return { id: createTaskPayload.id };
    };

    const handleCreateTask = async () => {
        const trimmedPrompt = taskPrompt.trim();
        if (!trimmedPrompt) {
            setValidationMessage("Enter a task before creating or executing.");
            return;
        }

        setValidationMessage(null);
        setCreatingTask(true);
        setStatusMessage("Creating task...");

        const abortController = new AbortController();
        abortControllersRef.current.add(abortController);
        console.log("[task-execution-panel] creating task without execution");

        try {
            await createTask(trimmedPrompt, abortController.signal);
            setTaskPrompt("");
            onTaskStarted();
            setStatusMessage("Task created.");
        } catch (error) {
            if (abortController.signal.aborted) {
                setStatusMessage("Task creation cancelled.");
                return;
            }
            const message =
                error instanceof Error ? error.message : "Unexpected error creating task.";
            setStatusMessage(`Error: ${message}`);
            console.warn("[task-execution-panel] task creation failed", error);
        } finally {
            abortControllersRef.current.delete(abortController);
            setCreatingTask(false);
        }
    };

    const handleExecuteTask = async () => {
        const trimmedPrompt = taskPrompt.trim();
        if (!trimmedPrompt) {
            setValidationMessage("Enter a task before creating or executing.");
            return;
        }

        setValidationMessage(null);
        setTaskPrompt("");
        setActiveRuns((count) => count + 1);
        setStatusMessage("Creating task and starting Codex...");

        const abortController = new AbortController();
        abortControllersRef.current.add(abortController);
        console.log("[task-execution-panel] creating and executing task");

        try {
            const createdTask = await createTask(trimmedPrompt, abortController.signal);

            const res = await fetch("/api/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
                body: JSON.stringify({
                    taskId: createdTask.id,
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

            onTaskStarted();

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

            setStatusMessage(null);
            console.log("[task-execution-panel] finished run");
        } catch (error) {
            if (abortController.signal.aborted) {
                setStatusMessage("Execution cancelled.");
                return;
            }
            const message =
                error instanceof Error ? error.message : "Unexpected error while executing.";
            setStatusMessage(`Error: ${message}`);
            console.warn("[task-execution-panel] run failed", error);
        } finally {
            abortControllersRef.current.delete(abortController);
            setActiveRuns((count) => Math.max(0, count - 1));
        }
    };

    // Keep task submission enabled even while runs are active so users can queue/create
    // another task or start another execution without waiting for the current run to finish.
    const canSubmitTask = Boolean(taskPrompt.trim()) && !creatingTask;

    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Task execution</h2>
                <p className="text-sm text-base-content/70">
                    Enter a task and either create it for later or execute it in a new worktree now.
                </p>
            </div>
            <div className="form-control gap-2">
                <textarea
                    placeholder="Enter task"
                    className="textarea textarea-bordered w-full min-h-[120px]"
                    value={taskPrompt}
                    onChange={(event) => setTaskPrompt(event.target.value)}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => void handleCreateTask()}
                        disabled={!canSubmitTask}
                    >
                        {creatingTask ? "Creating..." : "Create task"}
                    </button>
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => void handleExecuteTask()}
                        disabled={!canSubmitTask}
                    >
                        Execute task
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
