import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "./Markdown";
import type { ProjectDetailsPayload } from "./project-details/types";
import { WorktreePanel } from "./project-details/WorktreePanel";
import TaskExecutionPanel from "./TaskExecutionPanel";
import type { RepositorySummary } from "./types/repositories";

type ProjectDetailsProps = {
    drawerToggleId: string;
};

type DocumentSummary = {
    id: string;
    projectId: string | null;
    markdown: string;
};

type TaskItem = {
    id: string;
    projectId: string | null;
    description: string;
    createdAt: string;
    isDone: boolean;
    doneAt: string | null;
};

export function ProjectDetails({ drawerToggleId }: ProjectDetailsProps) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<ProjectDetailsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
    const [repositoriesLoading, setRepositoriesLoading] = useState(false);
    const [repositoriesError, setRepositoriesError] = useState<string | null>(null);
    const [repositorySelection, setRepositorySelection] = useState("");
    const [updatingRepository, setUpdatingRepository] = useState(false);
    const [isEditingRepository, setIsEditingRepository] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsError, setDocumentsError] = useState<string | null>(null);
    const [projectActionError, setProjectActionError] = useState<string | null>(null);
    const [isWorktreeDetailsOpen, setIsWorktreeDetailsOpen] = useState(false);
    const queryClient = useQueryClient();
    const shouldHideRightSidebar = isWorktreeDetailsOpen;

    useEffect(() => {
        if (!id) return;

        let active = true;
        const load = async (options?: { reset?: boolean }) => {
            const reset = options?.reset ?? false;
            setLoading((prev) => (reset ? true : prev));
            setError((prev) => (reset ? null : prev));
            setProject((prev) => (reset ? null : prev));
            try {
                const res = await fetch(`/api/projects/${id}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(payload?.error || "Project not found.");
                }
                if (!active) return;
                setProject(payload as ProjectDetailsPayload);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load project.";
                if (!active) return;
                setError(message);
            } finally {
                if (active) setLoading(false);
            }
        };

        void load({ reset: true });
        const interval = window.setInterval(() => {
            void load();
        }, 15000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [id]);

    useEffect(() => {
        setRepositorySelection(project?.repositoryId ?? "");
    }, [project?.repositoryId]);

    const refreshProject = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/projects/${id}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Project not found.");
            }
            setProject(payload as ProjectDetailsPayload);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to refresh project.";
            setError(message);
        }
    }, [id]);

    const loadRepositories = useCallback(async () => {
        setRepositoriesLoading(true);
        setRepositoriesError(null);
        try {
            const res = await fetch("/api/repositories");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load repositories.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as RepositorySummary[]) : [];
            setRepositories(list);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load repositories.";
            setRepositoriesError(message);
        } finally {
            setRepositoriesLoading(false);
        }
    }, []);

    const loadDocuments = useCallback(async () => {
        if (!id) return;
        setDocumentsLoading(true);
        setDocumentsError(null);
        try {
            const res = await fetch(`/api/projects/${id}/documents`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load documents.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as DocumentSummary[]) : [];
            setDocuments(list);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load documents.";
            setDocumentsError(message);
        } finally {
            setDocumentsLoading(false);
        }
    }, [id]);

    const {
        data: tasks = [],
        isLoading: tasksLoading,
        isFetching: tasksFetching,
        error: tasksQueryError,
        refetch: refetchTasks,
    } = useQuery<TaskItem[]>({
        queryKey: ["project-tasks", id],
        enabled: Boolean(id),
        refetchInterval: 15000,
        queryFn: async () => {
            if (!id) return [];
            const res = await fetch(`/api/projects/${id}/tasks?isDone=false`);
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
            if (!id) return;
            await queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
        },
    });
    const markTaskDoneErrorMessage =
        markTaskDoneError instanceof Error ? markTaskDoneError.message : null;

    const updateRepository = async (nextRepositoryId: string | null) => {
        if (!id) return;
        setProjectActionError(null);
        setUpdatingRepository(true);
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repositoryId: nextRepositoryId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to update repository.");
            }
            setProject(payload as ProjectDetailsPayload);
            setRepositorySelection(payload?.repositoryId ?? "");
            setIsEditingRepository(false);
            await loadRepositories();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update repository.";
            setProjectActionError(message);
        } finally {
            setUpdatingRepository(false);
        }
    };

    const deleteProject = async () => {
        if (!id) return;
        const confirmed = window.confirm(
            "Delete this project? Linked documents will be unassigned.",
        );
        if (!confirmed) return;
        setProjectActionError(null);
        setDeletingProject(true);
        try {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to delete project.");
            }
            navigate("/");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete project.";
            setProjectActionError(message);
        } finally {
            setDeletingProject(false);
        }
    };

    useEffect(() => {
        void loadRepositories();
    }, [loadRepositories]);

    useEffect(() => {
        if (!id) return;
        let active = true;

        const load = async () => {
            if (!active) return;
            await loadDocuments();
        };

        void load();
        const interval = window.setInterval(() => {
            void load();
        }, 15000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [id, loadDocuments]);

    const availableRepositories = useMemo(() => {
        return repositories.filter((repo) => !repo.projectId || repo.id === project?.repositoryId);
    }, [repositories, project?.repositoryId]);

    const currentRepositoryId = project?.repositoryId ?? "";
    const repositoryChanged = repositorySelection !== currentRepositoryId;

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
            <div className="rounded-2xl border border-base-300 bg-gradient-to-br from-base-200 to-base-100 shadow-sm">
                <div className="p-5 sm:p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.18em] text-base-content/60">
                                Project workspace
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-bold">
                                {project?.name ?? "Project details"}
                            </h1>
                            {repositoriesError && (
                                <div className="alert alert-error py-2 text-sm">
                                    <span>{repositoriesError}</span>
                                </div>
                            )}
                            {isEditingRepository ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        className="select select-bordered select-sm w-full sm:w-auto min-w-[260px]"
                                        value={repositorySelection}
                                        onChange={(event) =>
                                            setRepositorySelection(event.target.value)
                                        }
                                        disabled={repositoriesLoading || updatingRepository}
                                    >
                                        <option value="">
                                            {repositoriesLoading
                                                ? "Loading repositories..."
                                                : availableRepositories.length === 0
                                                  ? "No unlinked repositories"
                                                  : "No repository"}
                                        </option>
                                        {availableRepositories.map((repo) => (
                                            <option key={repo.id} value={repo.id}>
                                                {repo.name} - {repo.url}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() =>
                                            void updateRepository(
                                                repositorySelection.trim() || null,
                                            )
                                        }
                                        disabled={
                                            updatingRepository ||
                                            repositoriesLoading ||
                                            !repositoryChanged
                                        }
                                    >
                                        {updatingRepository ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            setRepositorySelection(currentRepositoryId);
                                            setIsEditingRepository(false);
                                        }}
                                        disabled={updatingRepository}
                                    >
                                        Cancel
                                    </button>
                                    {project?.repositoryId && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => void updateRepository(null)}
                                            disabled={updatingRepository}
                                        >
                                            Unlink
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="group flex items-start gap-2 text-xs sm:text-sm text-base-content/70 break-all">
                                    <div className="min-h-8 flex-1 pt-1">
                                        {project?.url ? (
                                            <a
                                                href={project.url}
                                                className="link link-hover"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {project.url}
                                            </a>
                                        ) : (
                                            "No repository linked yet."
                                        )}
                                    </div>
                                    {project && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                            onClick={() => setIsEditingRepository(true)}
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/" className="btn btn-outline btn-sm">
                                Back to projects
                            </Link>
                            <label
                                htmlFor={drawerToggleId}
                                className="btn btn-outline btn-sm lg:hidden"
                            >
                                Menu
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-base-content/70">
                    <span className="loading loading-spinner loading-sm" />
                    <span>Loading project&hellip;</span>
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

            {projectActionError && (
                <div className="alert alert-error">
                    <span>{projectActionError}</span>
                </div>
            )}

            {!loading && !error && project && (
                <div
                    className={`grid gap-6 ${
                        shouldHideRightSidebar
                            ? "xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
                            : "xl:grid-cols-[minmax(260px,320px)_minmax(0,1.6fr)_minmax(320px,1fr)]"
                    }`}
                >
                    <WorktreePanel
                        project={project}
                        onRefreshProject={refreshProject}
                        onWorktreeDetailsOpenChange={(isOpen) => setIsWorktreeDetailsOpen(isOpen)}
                        taskExecutionContent={
                            project.url ? (
                                <div className="card bg-base-200 border border-base-300 shadow-sm">
                                    <div className="card-body p-5 sm:p-6">
                                        <TaskExecutionPanel
                                            projectId={project.id}
                                            onTaskStarted={() => {
                                                void refreshProject();
                                                void queryClient.invalidateQueries({
                                                    queryKey: ["project-tasks", project.id],
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : null
                        }
                    />

                    {!shouldHideRightSidebar && (
                        <div className="space-y-6 xl:sticky xl:top-6 self-start">
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
                                            {tasksLoading || tasksFetching
                                                ? "Refreshing..."
                                                : "Refresh"}
                                        </button>
                                    </div>
                                    {tasksError && (
                                        <div className="alert alert-error py-2">
                                            <span className="text-sm">{tasksError}</span>
                                        </div>
                                    )}
                                    {markTaskDoneErrorMessage && (
                                        <div className="alert alert-error py-2">
                                            <span className="text-sm">
                                                {markTaskDoneErrorMessage}
                                            </span>
                                        </div>
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
                                                        <div className="text-xs text-base-content/60">
                                                            {new Date(
                                                                task.createdAt,
                                                            ).toLocaleString()}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-success"
                                                            onClick={() => markTaskDone(task.id)}
                                                            disabled={
                                                                markingTaskDone &&
                                                                markingTaskId === task.id
                                                            }
                                                        >
                                                            {markingTaskDone &&
                                                            markingTaskId === task.id
                                                                ? "Marking..."
                                                                : "Mark Done"}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap break-words">
                                                        {task.description}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card bg-base-200 border border-base-300 shadow-sm">
                                <div className="card-body p-5 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold">
                                            Related documents
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-xs"
                                                onClick={() => void loadDocuments()}
                                                disabled={documentsLoading}
                                            >
                                                {documentsLoading ? "Refreshing..." : "Refresh"}
                                            </button>
                                            <Link
                                                to="/documents"
                                                className="btn btn-outline btn-xs"
                                            >
                                                Open documents
                                            </Link>
                                        </div>
                                    </div>
                                    {documentsError && (
                                        <div className="alert alert-error py-2">
                                            <span className="text-sm">{documentsError}</span>
                                        </div>
                                    )}
                                    {documentsLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-base-content/70">
                                            <span className="loading loading-spinner loading-sm" />
                                            <span>Loading documents...</span>
                                        </div>
                                    ) : documents.length === 0 ? (
                                        <div className="text-sm text-base-content/70">
                                            No documents linked to this project yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                            {documents.map((doc, index) => (
                                                <div
                                                    key={doc.id}
                                                    className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-2"
                                                >
                                                    <div className="text-xs text-base-content/60">
                                                        Document {index + 1}
                                                    </div>
                                                    <Markdown
                                                        markdown={doc.markdown}
                                                        className="text-sm space-y-2"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card bg-error/10 border border-error/40 shadow-sm">
                                <div className="card-body p-5 space-y-3">
                                    <div className="text-sm font-semibold text-error">
                                        Danger zone
                                    </div>
                                    <p className="text-sm text-base-content/70">
                                        Delete this project and unlink all related documents.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-error btn-sm w-full sm:w-auto"
                                        onClick={() => void deleteProject()}
                                        disabled={deletingProject}
                                    >
                                        {deletingProject ? "Deleting..." : "Delete project"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
