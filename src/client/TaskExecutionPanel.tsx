import { useEffect, useRef, useState } from "react";
import { executeTaskById } from "./utils/executeTaskById";

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

    const handleExecuteTask = async () => {
        const trimmedPrompt = taskPrompt.trim();
        if (!trimmedPrompt) {
            setValidationMessage("Enter a task before executing.");
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

            setStatusMessage("Codex is running. Logs appear under the created worktree.");
            const result = await executeTaskById({
                taskId: createdTask.id,
                signal: abortController.signal,
                onStarted: onTaskStarted,
            });
            if (!result.completed) {
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

    // Keep task submission enabled even while runs are active so users can start another
    // execution without waiting for the current run to finish.
    const canSubmitTask = Boolean(taskPrompt.trim());

    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Task execution</h2>
                <p className="text-sm text-base-content/70">
                    Enter a task and execute it in a new worktree now.
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
