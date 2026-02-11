import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { emitSelectedRepo } from "./events";
import { Markdown } from "./Markdown";
import { ClonesSection } from "./project-details/ClonesSection";
import {
    buildPreviewTargets,
    parseLogsPayload,
    shouldShowProductionClone,
} from "./project-details/helpers";
import { LivePreviewSection } from "./project-details/LivePreviewSection";
import { ProductionCloneSection } from "./project-details/ProductionCloneSection";
import type { LogsMeta, PreviewTarget, ProjectDetailsPayload } from "./project-details/types";
import type { RepositorySummary } from "./types/repositories";

type ProjectDetailsProps = {
    drawerToggleId: string;
};

type LogsTarget = { key: string; path: string };
type DocumentSummary = {
    id: string;
    projectId: string | null;
    markdown: string;
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
    const [startingProduction, setStartingProduction] = useState(false);
    const [productionLogsOpen, setProductionLogsOpen] = useState(false);
    const [productionLogs, setProductionLogs] = useState<string[] | null>(null);
    const [productionLogsMeta, setProductionLogsMeta] = useState<LogsMeta | null>(null);
    const [devLogsTarget, setDevLogsTarget] = useState<LogsTarget | null>(null);
    const [devLogs, setDevLogs] = useState<string[] | null>(null);
    const [devLogsMeta, setDevLogsMeta] = useState<LogsMeta | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
    const [repositoriesLoading, setRepositoriesLoading] = useState(false);
    const [repositoriesError, setRepositoriesError] = useState<string | null>(null);
    const [repositorySelection, setRepositorySelection] = useState("");
    const [updatingRepository, setUpdatingRepository] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsError, setDocumentsError] = useState<string | null>(null);

    const showProductionClone = useMemo(() => {
        return shouldShowProductionClone(project);
    }, [project?.consoleRepositoryUrl, project?.url, project]);

    const previewTargets = useMemo<PreviewTarget[]>(() => {
        return buildPreviewTargets(project, showProductionClone);
    }, [
        project?.clones,
        project?.productionClone?.path,
        project?.productionClone?.port,
        showProductionClone,
        project,
    ]);

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
        if (!project?.url) return;
        emitSelectedRepo({ url: project.url, source: "project-details" });
    }, [project?.url]);

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

    const refreshProject = async () => {
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
    };

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

    const startDevServer = async (worktreePath: string, key: string) => {
        setActionError(null);
        setStartingDevKey(key);
        setDevLogsTarget({ key, path: worktreePath });
        setDevLogs(null);
        setDevLogsMeta(null);
        try {
            const res = await fetch("/api/worktrees/dev-server", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: worktreePath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to start dev server.");
            }
            await refreshProject();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to start dev server.";
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

    const refreshDevLogs = useCallback(async (worktreePath: string) => {
        try {
            const res = await fetch(
                `/api/worktrees/dev-logs?path=${encodeURIComponent(worktreePath)}`,
            );
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load dev logs.");
            }
            const parsed = parseLogsPayload(payload);
            setDevLogs(parsed.lines);
            setDevLogsMeta(parsed.meta);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load dev logs.";
            setActionError(message);
        }
    }, []);

    const startProductionServer = async () => {
        if (!project?.url) {
            setActionError("No repository linked to this project yet.");
            return;
        }
        setActionError(null);
        setStartingProduction(true);
        try {
            const res = await fetch("/api/production/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repositoryUrl: project.url }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to start production server.");
            }
            setProductionLogsOpen(true);
            await refreshProject();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to start production server.";
            setActionError(message);
        } finally {
            setStartingProduction(false);
        }
    };

    const refreshProductionLogs = useCallback(async () => {
        if (!project?.url) {
            setActionError("No repository linked to this project yet.");
            return;
        }
        try {
            const res = await fetch(
                `/api/production/logs?repositoryUrl=${encodeURIComponent(project.url)}`,
            );
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load production logs.");
            }
            const parsed = parseLogsPayload(payload);
            setProductionLogs(parsed.lines);
            setProductionLogsMeta(parsed.meta);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load production logs.";
            setActionError(message);
        }
    }, [project?.url]);

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
        if (!productionLogsOpen) return;
        void refreshProductionLogs();

        const interval = window.setInterval(() => {
            void refreshProductionLogs();
        }, 1500);

        return () => window.clearInterval(interval);
    }, [productionLogsOpen, refreshProductionLogs]);

    useEffect(() => {
        if (!devLogsTarget?.path) return;
        void refreshDevLogs(devLogsTarget.path);

        const interval = window.setInterval(() => {
            void refreshDevLogs(devLogsTarget.path);
        }, 1500);

        return () => window.clearInterval(interval);
    }, [devLogsTarget?.path, refreshDevLogs]);

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
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Project details</h1>
                    <p className="text-sm text-base-content/70 break-all">{id}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
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
                <div className="card bg-base-200 border border-base-300 shadow-md">
                    <div className="card-body space-y-4">
                        <div className="space-y-1">
                            <div className="text-sm text-base-content/60">Name</div>
                            <div className="text-xl font-semibold">{project.name}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-sm text-base-content/60">Repository</div>
                            {project.url ? (
                                <a
                                    href={project.url ?? undefined}
                                    className="link link-hover break-all"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {project.url ?? ""}
                                </a>
                            ) : (
                                <div className="text-sm text-base-content/70">
                                    No repository linked yet.
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm text-base-content/60">Update repository</div>
                            {repositoriesError && (
                                <div className="alert alert-error py-2">
                                    <span className="text-sm">{repositoriesError}</span>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    className="select select-bordered"
                                    value={repositorySelection}
                                    onChange={(event) => setRepositorySelection(event.target.value)}
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
                                            {repo.name} — {repo.url}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() =>
                                        void updateRepository(repositorySelection.trim() || null)
                                    }
                                    disabled={
                                        updatingRepository ||
                                        repositoriesLoading ||
                                        !repositoryChanged
                                    }
                                >
                                    {updatingRepository ? "Saving..." : "Save repository"}
                                </button>
                                {project.repositoryId && (
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
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-base-content/60">
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
                                <div className="space-y-3">
                                    {documents.map((doc, index) => (
                                        <div
                                            key={doc.id}
                                            className="card bg-base-100 border border-base-300"
                                        >
                                            <div className="card-body p-4 space-y-2">
                                                <div className="text-xs text-base-content/60">
                                                    Document {index + 1}
                                                </div>
                                                <Markdown
                                                    markdown={doc.markdown}
                                                    className="text-sm space-y-2"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {project.remoteBranch?.status === "upToDate" &&
                            project.remoteBranch.fetched === true && (
                                <div className="alert alert-success py-2">
                                    <span className="text-sm">
                                        Up to date with <span className="font-mono">origin</span>.
                                    </span>
                                </div>
                            )}

                        {typeof project.remoteBranch?.behindCount === "number" &&
                            project.remoteBranch.behindCount > 0 &&
                            project.remoteBranch.fetched === true &&
                            (project.remoteBranch.status === "behind" ||
                                project.remoteBranch.status === "diverged") && (
                                <div className="alert alert-warning py-2">
                                    <span className="text-sm">
                                        Remote has {project.remoteBranch.behindCount} commit
                                        {project.remoteBranch.behindCount === 1 ? "" : "s"} on{" "}
                                        <span className="font-mono">
                                            {project.remoteBranch.branch ?? "current branch"}
                                        </span>{" "}
                                        you haven&apos;t pulled locally.
                                    </span>
                                </div>
                            )}

                        <div className="divider my-0" />

                        <ClonesSection
                            clones={project.clones}
                            actionError={actionError}
                            onDismissActionError={() => setActionError(null)}
                            startingDevKey={startingDevKey}
                            openingVSCodePath={openingVSCodePath}
                            devLogsTarget={devLogsTarget}
                            devLogs={devLogs}
                            devLogsMeta={devLogsMeta}
                            onOpenInVSCode={(path) => void openInVSCode(path)}
                            onStartDevServer={(path, key) => void startDevServer(path, key)}
                            onRefreshDevLogs={(path) => void refreshDevLogs(path)}
                            onToggleDevLogs={(nextTarget) => setDevLogsTarget(nextTarget)}
                            onClearDevLogs={() => {
                                setDevLogs(null);
                                setDevLogsMeta(null);
                            }}
                        />

                        <ProductionCloneSection
                            project={project}
                            showProductionClone={showProductionClone}
                            previewProtocol={previewProtocol}
                            previewHost={previewHost}
                            startingDevKey={startingDevKey}
                            startingProduction={startingProduction}
                            openingVSCodePath={openingVSCodePath}
                            productionLogsOpen={productionLogsOpen}
                            productionLogs={productionLogs}
                            productionLogsMeta={productionLogsMeta}
                            onStartProductionServer={() => void startProductionServer()}
                            onOpenInVSCode={(path) => void openInVSCode(path)}
                            onToggleProductionLogs={() => setProductionLogsOpen((prev) => !prev)}
                            onRefreshProductionLogs={() => void refreshProductionLogs()}
                        />

                        <LivePreviewSection
                            previewTargets={previewTargets}
                            activePreviewKey={activePreviewKey}
                            previewUrl={previewUrl}
                            onChangeActivePreviewKey={(key) => setActivePreviewKey(key)}
                        />

                        <div className="divider my-0" />

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-base-content/60">
                                Delete project and unlink documents
                            </div>
                            <button
                                type="button"
                                className="btn btn-error btn-sm"
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
    );
}

export default ProjectDetails;
