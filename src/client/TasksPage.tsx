import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { TasksInfiniteCanvas } from "./tasks/TasksInfiniteCanvas";
import { TasksListView } from "./tasks/TasksListView";
import type { ProjectOption, TaskItem } from "./tasks/types";
import { getErrorMessage } from "./utils/errors";

type TasksPageProps = {
    drawerToggleId: string;
};

const SORT_ORDER_GAP = 1024;

function getSortOrderForMove(options: {
    list: { sortOrder: number }[];
    currentIndex: number;
    targetIndex: number;
}) {
    const listWithoutCurrent = options.list.filter((_, index) => index !== options.currentIndex);
    const insertIndex =
        options.targetIndex > options.currentIndex ? options.targetIndex - 1 : options.targetIndex;
    const before = listWithoutCurrent[insertIndex - 1] ?? null;
    const after = listWithoutCurrent[insertIndex] ?? null;

    if (before && after) {
        return Math.floor((before.sortOrder + after.sortOrder) / 2);
    }
    if (!before && after) {
        return after.sortOrder - SORT_ORDER_GAP;
    }
    if (before && !after) {
        return before.sortOrder + SORT_ORDER_GAP;
    }

    return options.list[options.currentIndex]?.sortOrder ?? 0;
}

export function TasksPage({ drawerToggleId }: TasksPageProps) {
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
    const [projectFilter, setProjectFilter] = useState<"all" | "assigned" | "unassigned">("all");
    const [viewMode, setViewMode] = useState<"list" | "canvas">("list");
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState("");

    const {
        data: tasks = [],
        isLoading,
        isFetching,
        error: tasksErrorRaw,
        refetch,
    } = useQuery<TaskItem[]>({
        queryKey: ["tasks", { statusFilter, projectFilter }],
        queryFn: async () => {
            console.info("[tasks] loading all tasks...");
            const searchParams = new URLSearchParams();
            if (statusFilter === "open") {
                searchParams.set("isDone", "false");
            }
            if (statusFilter === "done") {
                searchParams.set("isDone", "true");
            }
            if (projectFilter !== "all") {
                searchParams.set("project", projectFilter);
            }

            const query = searchParams.toString();
            const res = await fetch(query.length > 0 ? `/api/tasks?${query}` : "/api/tasks");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load tasks.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as TaskItem[]) : [];
            console.info(`[tasks] loaded ${list.length} tasks.`);
            return list;
        },
    });

    const { data: projects = [] } = useQuery<ProjectOption[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            console.info("[tasks] loading projects for assignment...");
            const res = await fetch("/api/projects");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load projects.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as ProjectOption[]) : [];
            console.info(`[tasks] loaded ${list.length} projects for assignment.`);
            return list;
        },
    });

    const { mutate: markDone, isPending: isMarkingDone } = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to mark task as done.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task marked done");
        },
    });

    const { mutate: deleteTask, isPending: isDeleting } = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to delete task.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task deleted");
        },
    });

    const { mutate: updateTaskProject, isPending: isUpdatingProject } = useMutation({
        mutationFn: async (input: { taskId: string; projectId: string | null }) => {
            const res = await fetch(`/api/tasks/${input.taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: input.projectId,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to update task project.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task project updated");
        },
    });

    const { mutate: updateTaskDescription, isPending: isUpdatingDescription } = useMutation({
        mutationFn: async (input: { taskId: string; description: string }) => {
            const res = await fetch(`/api/tasks/${input.taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: input.description,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to update task description.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            setEditingTaskId(null);
            setEditingDescription("");
            console.info("[tasks] task description updated");
        },
    });

    const { mutate: saveTaskCanvasPosition } = useMutation({
        mutationFn: async (input: { taskId: string; x: number; y: number }) => {
            const res = await fetch(`/api/tasks/${input.taskId}/canvas-position`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x: input.x, y: input.y }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to save task position.");
            }
        },
        onError: (error) => {
            console.error("[tasks] failed to save canvas position", error);
        },
        onSuccess: (_data, input) => {
            console.info("[tasks] saved task canvas position", {
                taskId: input.taskId,
                x: input.x,
                y: input.y,
            });
        },
    });

    const { mutate: createTaskConnection, isPending: isCreatingConnection } = useMutation({
        mutationFn: async (input: { taskId: string; connectedTaskId: string }) => {
            const res = await fetch("/api/tasks/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create task connection.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task connection created");
        },
    });

    const { mutate: deleteTaskConnection, isPending: isDeletingConnection } = useMutation({
        mutationFn: async (input: { taskId: string; connectedTaskId: string }) => {
            const res = await fetch("/api/tasks/connections", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to delete task connection.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task connection deleted");
        },
    });

    const reorderTasksMutation = useMutation({
        mutationFn: async (input: { taskId: string; sortOrder: number }) => {
            const res = await fetch("/api/tasks/order", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to reorder tasks.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            await queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
            console.info("[tasks] reordered");
        },
    });

    const tasksError = getErrorMessage(tasksErrorRaw);

    const isCanvasView = viewMode === "canvas";
    const canReorderTasks = statusFilter === "all" && projectFilter === "all";
    const reorderTasksError = getErrorMessage(reorderTasksMutation.error);

    const handleMoveTask = useCallback(
        (taskId: string, direction: "up" | "down") => {
            if (!canReorderTasks) {
                throw new Error("Task reordering is only supported in the unfiltered list view.");
            }

            const currentIndex = tasks.findIndex((task) => task.id === taskId);
            if (currentIndex < 0) {
                throw new Error("Task to reorder was not found in list.");
            }

            const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= tasks.length) {
                return;
            }

            const sortOrder = getSortOrderForMove({
                list: tasks,
                currentIndex,
                targetIndex,
            });
            reorderTasksMutation.mutate({ taskId, sortOrder });
        },
        [canReorderTasks, reorderTasksMutation, tasks],
    );

    const editingTask = editingTaskId
        ? (tasks.find((task) => task.id === editingTaskId) ?? null)
        : null;
    const canSaveTaskDescription =
        editingTask !== null &&
        editingDescription.trim().length > 0 &&
        editingDescription.trim() !== editingTask.description;

    return (
        <div
            className={`relative z-10 w-full p-6 ${
                isCanvasView
                    ? "flex h-[calc(100vh-73px)] flex-col gap-4"
                    : "mx-auto max-w-6xl space-y-6"
            }`}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Tasks</h1>
                    <p className="text-sm text-base-content/70">
                        Tasks in this workspace, including pending and completed runs.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void refetch()}
                        disabled={isLoading || isFetching}
                    >
                        {isLoading || isFetching ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {tasksError && (
                <div className="alert alert-error text-sm">
                    <span>{tasksError}</span>
                </div>
            )}
            {reorderTasksError && (
                <div className="alert alert-error text-sm">
                    <span>{reorderTasksError}</span>
                </div>
            )}

            <div className="card bg-base-200 border border-base-300 shadow-md">
                <div className="card-body p-4 flex flex-col md:flex-row md:items-end gap-3">
                    <label className="form-control w-full md:max-w-xs">
                        <span className="label-text text-sm font-medium">Status</span>
                        <select
                            className="select select-bordered"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value as typeof statusFilter)
                            }
                        >
                            <option value="all">All</option>
                            <option value="open">In progress only</option>
                            <option value="done">Done only</option>
                        </select>
                    </label>

                    <label className="form-control w-full md:max-w-xs">
                        <span className="label-text text-sm font-medium">Project</span>
                        <select
                            className="select select-bordered"
                            value={projectFilter}
                            onChange={(event) =>
                                setProjectFilter(event.target.value as typeof projectFilter)
                            }
                        >
                            <option value="all">All</option>
                            <option value="assigned">Assigned to a project</option>
                            <option value="unassigned">No project assigned</option>
                        </select>
                    </label>

                    <label className="label cursor-pointer gap-3 md:ml-auto">
                        <span className="label-text text-sm font-medium">Infinite canvas view</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={isCanvasView}
                            onChange={(event) =>
                                setViewMode(event.target.checked ? "canvas" : "list")
                            }
                        />
                    </label>
                    {!canReorderTasks && (
                        <div className="text-xs text-base-content/60">
                            Switch filters to <strong>All</strong> to reorder tasks.
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                    <div className="card-body">
                        <h2 className="card-title">No tasks yet</h2>
                        <p className="text-base-content/70">
                            Execute a task from a project page to see it appear here.
                        </p>
                    </div>
                </div>
            ) : isCanvasView ? (
                <div className="h-full min-h-0 flex-1">
                    <TasksInfiniteCanvas
                        tasks={tasks}
                        projects={projects}
                        isMarkingDone={isMarkingDone}
                        isDeleting={isDeleting}
                        isUpdatingProject={isUpdatingProject}
                        isCreatingConnection={isCreatingConnection}
                        isDeletingConnection={isDeletingConnection}
                        onMarkDone={markDone}
                        onDeleteTask={deleteTask}
                        onUpdateTaskProject={updateTaskProject}
                        onTaskMoved={(input) => saveTaskCanvasPosition(input)}
                        onConnectionCreate={(input) => createTaskConnection(input)}
                        onConnectionDelete={(input) => deleteTaskConnection(input)}
                        onTaskClick={(taskId) => {
                            const task = tasks.find((item) => item.id === taskId);
                            if (!task) {
                                throw new Error("Cannot edit a task that is not present.");
                            }
                            setEditingTaskId(task.id);
                            setEditingDescription(task.description);
                        }}
                    />
                </div>
            ) : (
                <TasksListView
                    tasks={tasks}
                    projects={projects}
                    isMarkingDone={isMarkingDone}
                    isDeleting={isDeleting}
                    isUpdatingProject={isUpdatingProject}
                    isReordering={reorderTasksMutation.isPending}
                    canReorder={canReorderTasks}
                    onMarkDone={markDone}
                    onDeleteTask={deleteTask}
                    onUpdateTaskProject={updateTaskProject}
                    onMoveTask={handleMoveTask}
                />
            )}

            {editingTask && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h3 className="text-lg font-semibold">Edit task</h3>
                        <p className="mt-1 text-sm text-base-content/70">
                            Task ID: <span className="font-mono">{editingTask.id}</span>
                        </p>
                        <label className="form-control mt-4">
                            <span className="label-text text-sm font-medium">Description</span>
                            <textarea
                                className="textarea textarea-bordered min-h-36"
                                value={editingDescription}
                                onChange={(event) => setEditingDescription(event.target.value)}
                                disabled={isUpdatingDescription}
                            />
                        </label>
                        <div className="modal-action">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                    setEditingTaskId(null);
                                    setEditingDescription("");
                                }}
                                disabled={isUpdatingDescription}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!canSaveTaskDescription || isUpdatingDescription}
                                onClick={() =>
                                    updateTaskDescription({
                                        taskId: editingTask.id,
                                        description: editingDescription.trim(),
                                    })
                                }
                            >
                                {isUpdatingDescription ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="modal-backdrop"
                        onClick={() => {
                            if (isUpdatingDescription) {
                                return;
                            }
                            setEditingTaskId(null);
                            setEditingDescription("");
                        }}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
