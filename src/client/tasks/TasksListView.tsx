import type { ProjectOption, TaskItem } from "./types";

type TasksListViewProps = {
    tasks: TaskItem[];
    projects: ProjectOption[];
    isMarkingDone: boolean;
    isDeleting: boolean;
    isUpdatingProject: boolean;
    onMarkDone: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTaskProject: (input: { taskId: string; projectId: string | null }) => void;
};

export function TasksListView({
    tasks,
    projects,
    isMarkingDone,
    isDeleting,
    isUpdatingProject,
    onMarkDone,
    onDeleteTask,
    onUpdateTaskProject,
}: TasksListViewProps) {
    return (
        <div className="overflow-x-auto card bg-base-200 border border-base-300 shadow-md">
            <table className="table table-zebra">
                <thead>
                    <tr>
                        <th>State</th>
                        <th>Project</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((task) => (
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
