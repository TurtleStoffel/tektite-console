import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getErrorMessage } from "./utils/errors";

type TasksPageProps = {
    drawerToggleId: string;
};

type TaskHistoryItem = {
    id: string;
    projectId: string | null;
    prompt: string;
    createdAt: string;
};

function formatTimestamp(value: string) {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return value;
    return timestamp.toLocaleString();
}

export function TasksPage({ drawerToggleId }: TasksPageProps) {
    const {
        data: tasks = [],
        isLoading,
        isFetching,
        error: tasksErrorRaw,
        refetch,
    } = useQuery<TaskHistoryItem[]>({
        queryKey: ["tasks"],
        queryFn: async () => {
            console.info("[tasks] loading all tasks...");
            const res = await fetch("/api/tasks");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load tasks.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as TaskHistoryItem[]) : [];
            console.info(`[tasks] loaded ${list.length} tasks.`);
            return list;
        },
    });

    const tasksError = getErrorMessage(tasksErrorRaw);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Tasks</h1>
                    <p className="text-sm text-base-content/70">
                        Complete history of task prompts executed in this workspace.
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
                                <th>Project</th>
                                <th>Prompt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task) => (
                                <tr key={task.id}>
                                    <td className="whitespace-nowrap text-sm text-base-content/80">
                                        {formatTimestamp(task.createdAt)}
                                    </td>
                                    <td className="whitespace-nowrap text-sm text-base-content/80">
                                        {task.projectId ?? "Unassigned"}
                                    </td>
                                    <td className="text-sm">{task.prompt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
