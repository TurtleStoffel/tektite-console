import type { ProjectOption, TaskItem } from "./types";

type TasksListViewProps = {
    tasks: TaskItem[];
    projects: ProjectOption[];
    isMarkingDone: boolean;
    isDeleting: boolean;
    isUpdatingProject: boolean;
    isCreatingConnection: boolean;
    isDeletingConnection: boolean;
    isReordering: boolean;
    canReorder: boolean;
    onMarkDone: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTaskProject: (input: { taskId: string; projectId: string | null }) => void;
    onCreateConnection: (input: { taskId: string; connectedTaskId: string }) => void;
    onDeleteConnection: (input: { taskId: string; connectedTaskId: string }) => void;
    onMoveTask: (taskId: string, direction: "up" | "down") => void;
};

export function TasksListView({
    tasks,
    projects,
    isMarkingDone,
    isDeleting,
    isUpdatingProject,
    isCreatingConnection,
    isDeletingConnection,
    isReordering,
    canReorder,
    onMarkDone,
    onDeleteTask,
    onUpdateTaskProject,
    onCreateConnection,
    onDeleteConnection,
    onMoveTask,
}: TasksListViewProps) {
    return (
        <div className="overflow-x-auto card bg-base-200 border border-base-300 shadow-md">
            <table className="table table-zebra">
                <thead>
                    <tr>
                        <th>State</th>
                        <th>Project</th>
                        <th>Description</th>
                        <th>Connections</th>
                        <th>Order</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((task, index) => (
                        <tr key={task.id}>
                            <td className="whitespace-nowrap">
                                <span
                                    className={`badge ${task.isDone ? "badge-success" : "badge-warning"}`}
                                >
                                    {task.isDone ? "Done" : "In progress"}
                                </span>
                            </td>
                            <td className="whitespace-nowrap text-sm text-base-content/80">
                                <label className="form-control w-52">
                                    <select
                                        className="select select-bordered select-xs"
                                        value={task.projectId ?? ""}
                                        disabled={isMarkingDone || isDeleting || isUpdatingProject}
                                        onChange={(event) => {
                                            const nextProjectId = event.target.value.trim() || null;
                                            onUpdateTaskProject({
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
                            <td className="min-w-72 text-sm">
                                <div className="flex flex-wrap gap-1">
                                    {task.connectionTaskIds.map((connectedTaskId) => (
                                        <button
                                            key={connectedTaskId}
                                            type="button"
                                            className="badge badge-outline"
                                            disabled={isCreatingConnection || isDeletingConnection}
                                            onClick={() =>
                                                onDeleteConnection({
                                                    taskId: task.id,
                                                    connectedTaskId,
                                                })
                                            }
                                            title="Remove connection"
                                        >
                                            {connectedTaskId.slice(0, 8)} x
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <label className="form-control">
                                        <select
                                            className="select select-bordered select-xs"
                                            defaultValue=""
                                            disabled={isCreatingConnection || isDeletingConnection}
                                            onChange={(event) => {
                                                const connectedTaskId = event.target.value.trim();
                                                if (connectedTaskId.length === 0) {
                                                    return;
                                                }
                                                onCreateConnection({
                                                    taskId: task.id,
                                                    connectedTaskId,
                                                });
                                                event.target.value = "";
                                            }}
                                        >
                                            <option value="">Connect to task...</option>
                                            {tasks
                                                .filter(
                                                    (candidate) =>
                                                        candidate.id !== task.id &&
                                                        !task.connectionTaskIds.includes(
                                                            candidate.id,
                                                        ),
                                                )
                                                .map((candidate) => (
                                                    <option key={candidate.id} value={candidate.id}>
                                                        {candidate.description}
                                                    </option>
                                                ))}
                                        </select>
                                    </label>
                                </div>
                            </td>
                            <td className="whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-ghost"
                                        disabled={
                                            isReordering ||
                                            !canReorder ||
                                            index === 0 ||
                                            isMarkingDone ||
                                            isDeleting
                                        }
                                        onClick={() => onMoveTask(task.id, "up")}
                                    >
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-ghost"
                                        disabled={
                                            isReordering ||
                                            !canReorder ||
                                            index === tasks.length - 1 ||
                                            isMarkingDone ||
                                            isDeleting
                                        }
                                        onClick={() => onMoveTask(task.id, "down")}
                                    >
                                        Down
                                    </button>
                                </div>
                            </td>
                            <td className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-success"
                                        disabled={task.isDone || isMarkingDone || isDeleting}
                                        onClick={() => onMarkDone(task.id)}
                                    >
                                        Mark done
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-error btn-outline"
                                        disabled={isMarkingDone || isDeleting}
                                        onClick={() => {
                                            if (!window.confirm("Delete this task?")) return;
                                            onDeleteTask(task.id);
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
    );
}
