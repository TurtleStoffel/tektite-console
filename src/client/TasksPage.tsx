import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage } from "./utils/errors";

type TasksPageProps = {
    drawerToggleId: string;
};

type TaskItem = {
    id: string;
    projectId: string | null;
    description: string;
    createdAt: string;
    isDone: boolean;
    doneAt: string | null;
};

type ProjectOption = {
    id: string;
    name: string | null;
};

function formatTimestamp(value: string) {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return value;
    return timestamp.toLocaleString();
}

export function TasksPage({ drawerToggleId }: TasksPageProps) {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
    const [projectFilter, setProjectFilter] = useState<"all" | "assigned" | "unassigned">("all");

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

    const tasksError = getErrorMessage(tasksErrorRaw);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 relative z-10">
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
            ) : (
                <div className="overflow-x-auto card bg-base-200 border border-base-300 shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Created</th>
                                <th>State</th>
                                <th>Project</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task) => (
                                <tr key={task.id}>
                                    <td className="whitespace-nowrap text-sm text-base-content/80">
                                        {formatTimestamp(task.createdAt)}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <span
                                            className={`badge ${
                                                task.isDone ? "badge-success" : "badge-warning"
                                            }`}
                                        >
                                            {task.isDone ? "Done" : "In progress"}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap text-sm text-base-content/80">
                                        <label className="form-control w-52">
                                            <select
                                                className="select select-bordered select-xs"
                                                value={task.projectId ?? ""}
                                                disabled={
                                                    isMarkingDone || isDeleting || isUpdatingProject
                                                }
                                                onChange={(event) => {
                                                    const nextProjectId =
                                                        event.target.value.trim() || null;
                                                    updateTaskProject({
                                                        taskId: task.id,
                                                        projectId: nextProjectId,
                                                    });
                                                }}
                                            >
                                                <option value="">Unassigned</option>
                                                {projects.map((project) => (
                                                    <option key={project.id} value={project.id}>
                                                        {project.name?.trim() || project.id}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </td>
                                    <td className="text-sm">{task.description}</td>
                                    <td className="whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-success"
                                                disabled={
                                                    task.isDone || isMarkingDone || isDeleting
                                                }
                                                onClick={() => markDone(task.id)}
                                            >
                                                Mark done
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-error btn-outline"
                                                disabled={isMarkingDone || isDeleting}
                                                onClick={() => {
                                                    if (!window.confirm("Delete this task?"))
                                                        return;
                                                    deleteTask(task.id);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
