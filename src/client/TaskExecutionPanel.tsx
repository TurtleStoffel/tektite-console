import { useState } from "react";
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
    const [isQueueing, setIsQueueing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const createTask = async (trimmedPrompt: string): Promise<{ id: string }> => {
        const createTaskRes = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: trimmedPrompt,
                projectId,
            }),
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
        setIsQueueing(true);
        setStatusMessage("Creating task and queueing Codex run...");
        console.log("[task-execution-panel] creating and executing task");

        try {
            const createdTask = await createTask(trimmedPrompt);

            const result = await executeTaskById({
                taskId: createdTask.id,
                onQueued: () => onTaskStarted(),
            });
            setStatusMessage(`Run queued (${result.runId.slice(0, 8)}...).`);
            console.info("[task-execution-panel] queued run", { runId: result.runId });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unexpected error while executing.";
            setStatusMessage(`Error: ${message}`);
            console.warn("[task-execution-panel] run failed", error);
        } finally {
            setIsQueueing(false);
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
                        disabled={!canSubmitTask || isQueueing}
                    >
                        {isQueueing ? "Queueing..." : "Execute task"}
                    </button>
                </div>
                {validationMessage && (
                    <p className="text-sm text-base-content/70">{validationMessage}</p>
                )}
                {statusMessage && <p className="text-sm text-base-content/70">{statusMessage}</p>}
            </div>
        </>
    );
}
