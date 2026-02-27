import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { executeTaskById } from "../utils/executeTaskById";

type TaskItem = {
    id: string;
    projectId: string | null;
    description: string;
    createdAt: string;
    isDone: boolean;
    doneAt: string | null;
};

type ProjectTasksCardProps = {
    projectId: string;
    onTaskExecutionStarted: () => void;
    onTaskClick: (task: TaskItem) => void;
};

export function ProjectTasksCard({
    projectId,
    onTaskExecutionStarted,
    onTaskClick,
}: ProjectTasksCardProps) {
    const [taskDraft, setTaskDraft] = useState("");
    const [executeStatusMessage, setExecuteStatusMessage] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const {
        data: tasks = [],
        isLoading: tasksLoading,
        isFetching: tasksFetching,
        error: tasksQueryError,
        refetch: refetchTasks,
    } = useQuery<TaskItem[]>({
        queryKey: ["project-tasks", projectId],
        refetchInterval: 15000,
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/tasks?isDone=false`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load tasks.");
            }
            return Array.isArray(payload?.data) ? (payload.data as TaskItem[]) : [];
        },
    });
    const tasksError = tasksQueryError instanceof Error ? tasksQueryError.message : null;

    const {
        mutate: markTaskDone,
        isPending: markingTaskDone,
        variables: markingTaskId,
        error: markTaskDoneError,
    } = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to mark task as done.");
            }
            return payload?.data as TaskItem;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
        },
    });
    const markTaskDoneErrorMessage =
        markTaskDoneError instanceof Error ? markTaskDoneError.message : null;

    const {
        mutate: createTask,
        isPending: creatingTask,
        error: createTaskError,
    } = useMutation({
        mutationFn: async (description: string) => {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description,
                    projectId,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create task.");
            }
            if (typeof payload?.id !== "string" || payload.id.length === 0) {
                throw new Error("Task creation returned an invalid task id.");
            }
            console.info("[project-tasks-card] task created", { projectId, taskId: payload.id });
            return payload.id as string;
        },
        onSuccess: async () => {
            setTaskDraft("");
            await queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
        },
    });
    const createTaskErrorMessage =
        createTaskError instanceof Error ? createTaskError.message : null;

    const {
        mutate: executeTask,
        isPending: executingTask,
        variables: executingTaskId,
        error: executeTaskError,
    } = useMutation({
        mutationFn: async (taskId: string) => {
            const result = await executeTaskById({
                taskId,
                onQueued: () => {
                    onTaskExecutionStarted();
                },
            });
            setExecuteStatusMessage(`Run queued (${result.runId.slice(0, 8)}...).`);
        },
    });
    const executeTaskErrorMessage =
        executeTaskError instanceof Error ? executeTaskError.message : null;

    return (
        <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Tasks</div>
                    <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => void refetchTasks()}
                        disabled={tasksLoading || tasksFetching}
                    >
                        {tasksLoading || tasksFetching ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
                <div className="space-y-2">
                    <textarea
                        placeholder="Create a task for this project"
                        className="textarea textarea-bordered w-full min-h-[90px]"
                        value={taskDraft}
                        onChange={(event) => setTaskDraft(event.target.value)}
                    />
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => createTask(taskDraft.trim())}
                        disabled={!taskDraft.trim() || creatingTask}
                    >
                        {creatingTask ? "Creating..." : "Create task"}
                    </button>
                </div>
                {tasksError && (
                    <div className="alert alert-error py-2">
                        <span className="text-sm">{tasksError}</span>
                    </div>
                )}
                {createTaskErrorMessage && (
                    <div className="alert alert-error py-2">
                        <span className="text-sm">{createTaskErrorMessage}</span>
                    </div>
                )}
                {markTaskDoneErrorMessage && (
                    <div className="alert alert-error py-2">
                        <span className="text-sm">{markTaskDoneErrorMessage}</span>
                    </div>
                )}
                {executeTaskErrorMessage && (
                    <div className="alert alert-error py-2">
                        <span className="text-sm">{executeTaskErrorMessage}</span>
                    </div>
                )}
                {executeStatusMessage && (
                    <p className="text-sm text-base-content/70">{executeStatusMessage}</p>
                )}
                {tasksLoading ? (
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <span className="loading loading-spinner loading-sm" />
                        <span>Loading tasks...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-sm text-base-content/70">
                        No pending tasks for this project.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        className="text-left text-xs text-base-content/60 hover:underline"
                                        onClick={() => onTaskClick(task)}
                                    >
                                        {new Date(task.createdAt).toLocaleString()}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline"
                                            onClick={() => executeTask(task.id)}
                                            disabled={
                                                (executingTask && executingTaskId === task.id) ||
                                                markingTaskDone
                                            }
                                        >
                                            {executingTask && executingTaskId === task.id
                                                ? "Executing..."
                                                : "Execute"}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-success"
                                            onClick={() => markTaskDone(task.id)}
                                            disabled={markingTaskDone && markingTaskId === task.id}
                                        >
                                            {markingTaskDone && markingTaskId === task.id
                                                ? "Marking..."
                                                : "Mark Done"}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="w-full text-left text-sm whitespace-pre-wrap break-words"
                                    onClick={() => onTaskClick(task)}
                                >
                                    {task.description}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
