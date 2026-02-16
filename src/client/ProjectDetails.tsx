import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "./Markdown";
import { ClonesSection } from "./project-details/ClonesSection";
import { buildPreviewTargets } from "./project-details/helpers";
import { LivePreviewSection } from "./project-details/LivePreviewSection";
import type { PreviewTarget, ProjectDetailsPayload } from "./project-details/types";
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

type TaskHistoryItem = {
    id: string;
    projectId: string | null;
    prompt: string;
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
    const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
    const [startingDevKey, setStartingDevKey] = useState<string | null>(null);
    const [openingVSCodePath, setOpeningVSCodePath] = useState<string | null>(null);
    const [openDevTerminals, setOpenDevTerminals] = useState<Record<string, boolean>>({});
    const [devTerminalSessions, setDevTerminalSessions] = useState<Record<string, string | null>>(
        {},
    );
    const [actionError, setActionError] = useState<string | null>(null);
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
    const queryClient = useQueryClient();

    const previewTargets = useMemo<PreviewTarget[]>(() => {
        return buildPreviewTargets(project);
    }, [project?.clones, project]);

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

    useEffect(() => {
        if (previewTargets.length === 0) {
            setActivePreviewKey(null);
            return;
        }

        const firstKey = previewTargets[0]?.key ?? null;
        setActivePreviewKey((prev) => {
            if (prev && previewTargets.some((target) => target.key === prev)) return prev;
            return firstKey;
        });
    }, [previewTargets]);

    const activePreviewTarget = previewTargets.find((target) => target.key === activePreviewKey);
    const previewPort = activePreviewTarget?.port ?? null;
    const previewProtocol =
        typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
    const previewHost =
        typeof window !== "undefined" && window.location.hostname
            ? window.location.hostname
            : "localhost";
    const previewUrl =
        typeof previewPort === "number"
            ? `${previewProtocol}://${previewHost}:${previewPort}/`
            : null;

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
            setActionError(message);
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
        data: taskHistory = [],
        isLoading: taskHistoryLoading,
        isFetching: taskHistoryFetching,
        error: taskHistoryQueryError,
        refetch: refetchTaskHistory,
    } = useQuery<TaskHistoryItem[]>({
        queryKey: ["project-task-history", id],
        enabled: Boolean(id),
        refetchInterval: 15000,
        queryFn: async () => {
            if (!id) return [];
            const res = await fetch(`/api/projects/${id}/tasks?isDone=false`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load task history.");
            }
            return Array.isArray(payload?.data) ? (payload.data as TaskHistoryItem[]) : [];
        },
    });
    const taskHistoryError =
        taskHistoryQueryError instanceof Error ? taskHistoryQueryError.message : null;
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
            return payload?.data as TaskHistoryItem;
        },
        onSuccess: async () => {
            if (!id) return;
            await queryClient.invalidateQueries({ queryKey: ["project-task-history", id] });
        },
    });
    const markTaskDoneErrorMessage =
        markTaskDoneError instanceof Error ? markTaskDoneError.message : null;

    const startDevTerminal = async (worktreePath: string, key: string) => {
        setActionError(null);
        setStartingDevKey(key);
        setOpenDevTerminals((prev) => ({ ...prev, [worktreePath]: true }));
        try {
            const res = await fetch("/api/worktrees/dev-terminal/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: worktreePath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to start terminal.");
            }
            const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : null;
            setDevTerminalSessions((prev) => ({
                ...prev,
                [worktreePath]: sessionId,
            }));
            await refreshProject();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to start terminal.";
            setActionError(message);
        } finally {
            setStartingDevKey(null);
        }
    };

    const openInVSCode = async (folderPath: string) => {
        setActionError(null);
        setOpeningVSCodePath(folderPath);
        try {
            const res = await fetch("/api/editor/open-vscode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: folderPath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to open VSCode.");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to open VSCode.";
            setActionError(message);
        } finally {
            setOpeningVSCodePath(null);
        }
    };

    const resumeCodexThreadWithComment = async (
        worktreePath: string,
        threadId: string,
        comment: string,
    ) => {
        if (!id) {
            throw new Error("Project id is required.");
        }

        setActionError(null);
        const res = await fetch("/api/resume", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify({
                comment,
                projectId: id,
                worktreePath,
                threadId,
            }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.error || "Failed to resume Codex thread.");
        }

        if (!res.body) {
            throw new Error("Server did not return a streaming response.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processEvent = (rawEvent: string) => {
            const dataLines = rawEvent
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.replace(/^data:\s?/, ""))
                .filter(Boolean);
            if (!dataLines.length) return;

            const payload = JSON.parse(dataLines.join("\n")) as { type?: string; error?: string };
            if (payload.type === "error") {
                throw new Error(payload.error || "Codex run failed.");
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let boundaryIndex = buffer.indexOf("\n\n");
            while (boundaryIndex !== -1) {
                const rawEvent = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                processEvent(rawEvent);
                boundaryIndex = buffer.indexOf("\n\n");
            }
        }

        buffer += decoder.decode();
        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            processEvent(rawEvent);
            boundaryIndex = buffer.indexOf("\n\n");
        }

        await refreshProject();
        await queryClient.invalidateQueries({
            queryKey: ["project-task-history", id],
        });
    };

    const updateRepository = async (nextRepositoryId: string | null) => {
        if (!id) return;
        setActionError(null);
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
            setActionError(message);
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
        setActionError(null);
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
            setActionError(message);
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
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
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

            {!loading && !error && project && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <div className="space-y-6">
                        {project.url && (
                            <div className="card bg-base-200 border border-base-300 shadow-sm">
                                <div className="card-body p-5 sm:p-6">
                                    <TaskExecutionPanel
                                        selectedRepoUrl={project.url}
                                        projectId={project.id}
                                        onTaskStarted={() => {
                                            void refreshProject();
                                            void queryClient.invalidateQueries({
                                                queryKey: ["project-task-history", project.id],
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="card bg-base-200 border border-base-300 shadow-sm">
                            <div className="card-body p-5 sm:p-6 space-y-5">
                                <ClonesSection
                                    clones={project.clones}
                                    actionError={actionError}
                                    onDismissActionError={() => setActionError(null)}
                                    startingDevKey={startingDevKey}
                                    openingVSCodePath={openingVSCodePath}
                                    openDevTerminals={openDevTerminals}
                                    devTerminalSessions={devTerminalSessions}
                                    onOpenInVSCode={(path) => void openInVSCode(path)}
                                    onOpenDevTerminal={(path, key) =>
                                        void startDevTerminal(path, key)
                                    }
                                    onToggleDevTerminal={(worktreePath, isOpen) =>
                                        setOpenDevTerminals((prev) => ({
                                            ...prev,
                                            [worktreePath]: isOpen,
                                        }))
                                    }
                                    onResumeCodexThread={(worktreePath, threadId, comment) =>
                                        resumeCodexThreadWithComment(
                                            worktreePath,
                                            threadId,
                                            comment,
                                        )
                                    }
                                />
                                <LivePreviewSection
                                    previewTargets={previewTargets}
                                    activePreviewKey={activePreviewKey}
                                    previewUrl={previewUrl}
                                    onChangeActivePreviewKey={(key) => setActivePreviewKey(key)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 xl:sticky xl:top-6 self-start">
                        <div className="card bg-base-200 border border-base-300 shadow-sm">
                            <div className="card-body p-5 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold">Task history</div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-xs"
                                        onClick={() => void refetchTaskHistory()}
                                        disabled={taskHistoryLoading || taskHistoryFetching}
                                    >
                                        {taskHistoryLoading || taskHistoryFetching
                                            ? "Refreshing..."
                                            : "Refresh"}
                                    </button>
                                </div>
                                {taskHistoryError && (
                                    <div className="alert alert-error py-2">
                                        <span className="text-sm">{taskHistoryError}</span>
                                    </div>
                                )}
                                {markTaskDoneErrorMessage && (
                                    <div className="alert alert-error py-2">
                                        <span className="text-sm">{markTaskDoneErrorMessage}</span>
                                    </div>
                                )}
                                {taskHistoryLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                                        <span className="loading loading-spinner loading-sm" />
                                        <span>Loading task history...</span>
                                    </div>
                                ) : taskHistory.length === 0 ? (
                                    <div className="text-sm text-base-content/70">
                                        No pending tasks for this project.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                                        {taskHistory.map((task) => (
                                            <div
                                                key={task.id}
                                                className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs text-base-content/60">
                                                        {new Date(task.createdAt).toLocaleString()}
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
                                                    {task.prompt}
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
                                    <div className="text-sm font-semibold">Related documents</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-xs"
                                            onClick={() => void loadDocuments()}
                                            disabled={documentsLoading}
                                        >
                                            {documentsLoading ? "Refreshing..." : "Refresh"}
                                        </button>
                                        <Link to="/documents" className="btn btn-outline btn-xs">
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
                                <div className="text-sm font-semibold text-error">Danger zone</div>
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
                </div>
            )}
        </div>
    );
}
