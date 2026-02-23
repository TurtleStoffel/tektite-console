import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type CreateTaskResponse = {
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

export function QuickTaskMenu() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskPrompt, setTaskPrompt] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const { data: projects = [], isLoading: isProjectsLoading } = useQuery<ProjectOption[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            console.info("[quick-task] loading projects for assignment...");
            const res = await fetch("/api/projects");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load projects.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as ProjectOption[]) : [];
            console.info(`[quick-task] loaded ${list.length} projects for assignment.`);
            return list;
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: async (input: { description: string; projectId: string | null }) => {
            const response = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = (await response.json().catch(() => ({}))) as {
                error?: string;
            } & Partial<CreateTaskResponse>;

            if (!response.ok) {
                throw new Error(payload.error ?? "Failed to create quick task.");
            }

            if (!payload.id || typeof payload.id !== "string") {
                throw new Error("Task creation returned an invalid id.");
            }

            return payload as CreateTaskResponse;
        },
        onSuccess: async (createdTask) => {
            console.info("[quick-task] created quick task", {
                id: createdTask.id,
                projectId: createdTask.projectId,
            });
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            await queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
            setTaskPrompt("");
            setSelectedProjectId("");
            setValidationMessage(null);
            setStatusMessage("Quick task created.");
            setIsModalOpen(false);
        },
        onError: (error) => {
            console.warn("[quick-task] failed to create quick task", error);
            setStatusMessage(
                error instanceof Error ? error.message : "Failed to create quick task.",
            );
        },
    });

    const handleOpenModal = () => {
        setStatusMessage(null);
        setValidationMessage(null);
        setSelectedProjectId("");
        setIsModalOpen(true);
    };

    const handleCreateTask = () => {
        const trimmedPrompt = taskPrompt.trim();
        if (!trimmedPrompt) {
            setValidationMessage("Enter a task before creating it.");
            return;
        }

        setValidationMessage(null);
        setStatusMessage(null);
        createTaskMutation.mutate({
            description: trimmedPrompt,
            projectId: selectedProjectId || null,
        });
    };

    const handleCloseModal = () => {
        if (createTaskMutation.isPending) return;
        setIsModalOpen(false);
    };

    return (
        <>
            <div className="dropdown dropdown-end">
                <button
                    type="button"
                    tabIndex={0}
                    className="btn btn-sm btn-outline"
                    aria-label="Open header actions menu"
                >
                    Actions
                </button>
                <ul className="menu dropdown-content z-[60] mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow">
                    <li>
                        <button type="button" onClick={handleOpenModal}>
                            Quick Task
                        </button>
                    </li>
                </ul>
            </div>

            <dialog className={`modal ${isModalOpen ? "modal-open" : ""}`}>
                <div className="modal-box max-w-xl space-y-4">
                    <h3 className="text-lg font-semibold">Create Quick Task</h3>
                    <p className="text-sm text-base-content/70">
                        Create a task now and optionally attach it to a project.
                    </p>
                    <label className="form-control w-full">
                        <div className="label pb-1">
                            <span className="label-text">Project</span>
                        </div>
                        <select
                            className="select select-bordered w-full"
                            value={selectedProjectId}
                            onChange={(event) => setSelectedProjectId(event.target.value)}
                            disabled={createTaskMutation.isPending || isProjectsLoading}
                        >
                            <option value="">Unassigned</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name?.trim() || project.id}
                                </option>
                            ))}
                        </select>
                    </label>
                    <textarea
                        className="textarea textarea-bordered min-h-28 w-full"
                        placeholder="Enter task"
                        value={taskPrompt}
                        onChange={(event) => setTaskPrompt(event.target.value)}
                    />
                    {validationMessage ? (
                        <div className="alert alert-error py-2 text-sm">{validationMessage}</div>
                    ) : null}
                    {statusMessage ? (
                        <div className="alert py-2 text-sm">{statusMessage}</div>
                    ) : null}
                    <div className="modal-action">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleCloseModal}
                            disabled={createTaskMutation.isPending}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCreateTask}
                            disabled={createTaskMutation.isPending}
                        >
                            {createTaskMutation.isPending ? "Creating..." : "Create"}
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button type="button" onClick={handleCloseModal}>
                        close
                    </button>
                </form>
            </dialog>
        </>
    );
}
