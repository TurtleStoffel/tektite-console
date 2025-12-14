import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { emitSelectedRepo } from "./events";
import { LogsPanel } from "./LogsPanel";

type ProjectDetailsProps = {
    drawerToggleId: string;
};

type ProjectDetailsPayload = {
    id: string;
    name: string;
    url: string;
    nodeCount: number;
    flowCount: number;
    productionClone?: {
        path: string;
        exists: boolean;
        port: number | null;
        commitHash: string | null;
        commitDescription: string | null;
        hasChanges: boolean | null;
        inUse: boolean;
    };
    clones?: Array<{
        path: string;
        location: "clonesDir";
        port?: number | null;
        commitHash?: string | null;
        commitDescription?: string | null;
        isWorktree?: boolean;
        inUse: boolean;
        hasChanges?: boolean;
        prStatus?:
            | {
                  state: "open" | "closed" | "merged" | "draft" | "none" | "unknown";
                  number?: number;
                  title?: string;
                  url?: string;
              }
            | null;
    }>;
};

export function ProjectDetails({ drawerToggleId }: ProjectDetailsProps) {
    const { id } = useParams();
    const [project, setProject] = useState<ProjectDetailsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
    const [startingDevKey, setStartingDevKey] = useState<string | null>(null);
    const [startingProduction, setStartingProduction] = useState(false);
    const [productionLogsOpen, setProductionLogsOpen] = useState(false);
    const [productionLogs, setProductionLogs] = useState<string[] | null>(null);
    const [productionLogsMeta, setProductionLogsMeta] = useState<{
        path: string | null;
        exists: boolean;
        running: boolean;
        installing: boolean;
    } | null>(null);
    const [devLogsTarget, setDevLogsTarget] = useState<{ key: string; path: string } | null>(null);
    const [devLogs, setDevLogs] = useState<string[] | null>(null);
    const [devLogsMeta, setDevLogsMeta] = useState<{
        path: string | null;
        exists: boolean;
        running: boolean;
        installing: boolean;
    } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const parseLogPayload = (payload: any) => {
        const lines = Array.isArray(payload?.lines) ? (payload.lines as unknown[]).filter((line) => typeof line === "string") : [];
        const partial = payload?.partial;
        const partialLines: string[] = [];
        if (partial && typeof partial === "object") {
            const stdout = typeof partial.stdout === "string" ? partial.stdout : "";
            const stderr = typeof partial.stderr === "string" ? partial.stderr : "";
            if (stdout.trim()) partialLines.push(`[stdout] ${stdout.trimEnd()}`);
            if (stderr.trim()) partialLines.push(`[stderr] ${stderr.trimEnd()}`);
        }

        return {
            lines: [...lines, ...partialLines],
            meta: {
                path: typeof payload?.path === "string" ? payload.path : null,
                exists: Boolean(payload?.exists),
                running: Boolean(payload?.running),
                installing: Boolean(payload?.installing),
            },
        };
    };

    type PreviewTarget = {
        key: string;
        label: string;
        port: number;
    };

    const previewTargets = useMemo<PreviewTarget[]>(() => {
        const targets: PreviewTarget[] = [];

        for (const clone of project?.clones ?? []) {
            if (typeof clone.port !== "number" || !Number.isFinite(clone.port)) continue;
            targets.push({
                key: `clone:${clone.path}`,
                label: `clone · ${clone.port}`,
                port: clone.port,
            });
        }

        if (typeof project?.productionClone?.port === "number" && Number.isFinite(project.productionClone.port)) {
            targets.push({
                key: `production:${project.productionClone.path}`,
                label: `production · ${project.productionClone.port}`,
                port: project.productionClone.port,
            });
        }

        return targets;
    }, [project?.clones, project?.productionClone?.path, project?.productionClone?.port]);

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
                if (!active) return;
                setLoading(false);
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
    const previewProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
    const previewHost = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
    const previewUrl = typeof previewPort === "number" ? `${previewProtocol}://${previewHost}:${previewPort}/` : null;

    const prBadgeClass = (state: NonNullable<NonNullable<ProjectDetailsPayload["clones"]>[number]["prStatus"]>["state"]) => {
        switch (state) {
            case "open":
                return "badge-success";
            case "draft":
                return "badge-warning";
            case "merged":
                return "badge-secondary";
            case "closed":
                return "badge-error";
            case "none":
                return "badge-ghost";
            case "unknown":
            default:
                return "badge-outline";
        }
    };

    const prBadgeLabel = (
        prStatus: NonNullable<NonNullable<ProjectDetailsPayload["clones"]>[number]["prStatus"]>,
    ) => {
        switch (prStatus.state) {
            case "open":
                return "PR open";
            case "draft":
                return "PR draft";
            case "merged":
                return "PR merged";
            case "closed":
                return "PR closed";
            case "none":
                return "No PR";
            case "unknown":
            default:
                return "PR ?";
        }
    };

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

    const refreshDevLogs = async (worktreePath: string) => {
        try {
            const res = await fetch(`/api/worktrees/dev-logs?path=${encodeURIComponent(worktreePath)}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load dev logs.");
            }
            const parsed = parseLogPayload(payload);
            setDevLogs(parsed.lines);
            setDevLogsMeta(parsed.meta);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load dev logs.";
            setActionError(message);
        }
    };

    const startProductionServer = async () => {
        if (!project?.url) return;
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
            const message = err instanceof Error ? err.message : "Failed to start production server.";
            setActionError(message);
        } finally {
            setStartingProduction(false);
        }
    };

    const refreshProductionLogs = async () => {
        if (!project?.url) return;
        try {
            const res = await fetch(`/api/production/logs?repositoryUrl=${encodeURIComponent(project.url)}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load production logs.");
            }
            const parsed = parseLogPayload(payload);
            setProductionLogs(parsed.lines);
            setProductionLogsMeta(parsed.meta);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load production logs.";
            setActionError(message);
        }
    };

    useEffect(() => {
        if (!productionLogsOpen) return;
        void refreshProductionLogs();

        const interval = window.setInterval(() => {
            void refreshProductionLogs();
        }, 1500);

        return () => window.clearInterval(interval);
    }, [productionLogsOpen, project?.url]);

    useEffect(() => {
        if (!devLogsTarget?.path) return;
        void refreshDevLogs(devLogsTarget.path);

        const interval = window.setInterval(() => {
            void refreshDevLogs(devLogsTarget.path);
        }, 1500);

        return () => window.clearInterval(interval);
    }, [devLogsTarget?.path]);

    return (
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Project details</h1>
                    <p className="text-sm text-base-content/70 break-all">{id}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/editor" className="btn btn-outline btn-sm">
                        Back to editor
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
                            <a href={project.url} className="link link-hover break-all" target="_blank" rel="noreferrer">
                                {project.url}
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="badge badge-outline">{project.nodeCount} nodes</div>
                            <div className="badge badge-outline">{project.flowCount} flows</div>
                        </div>

                        <div className="divider my-0" />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Local clones</div>
                                <span className="text-xs text-base-content/60">{project.clones?.length ?? 0}</span>
                            </div>
                            {actionError && (
                                <div className="alert alert-error py-2">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="text-sm">{actionError}</span>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => setActionError(null)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!project.clones || project.clones.length === 0 ? (
                                <div className="text-sm text-base-content/70">No clones found in configured folders.</div>
                            ) : (
                                <div className="space-y-2">
                                    {project.clones.map((clone) => {
                                        const key = `clone:${clone.path}`;
                                        const showRunDev =
                                            Boolean(clone.isWorktree) && !clone.inUse && typeof clone.port !== "number";
                                        const isStarting = startingDevKey === key;
                                        const devLogsOpen = devLogsTarget?.key === key;

                                        return (
                                            <div key={key} className="space-y-2">
                                                <div className="p-3 border border-base-300 rounded-xl bg-base-100/60 flex items-center justify-between gap-3">
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="font-mono text-xs break-all">{clone.path}</div>
                                                        {clone.isWorktree &&
                                                            (clone.prStatus?.state === "open" ||
                                                                clone.prStatus?.state === "draft") &&
                                                            clone.prStatus.url && (
                                                                <a
                                                                    className="link link-hover text-xs break-all"
                                                                    href={clone.prStatus.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    View PR{" "}
                                                                    {typeof clone.prStatus.number === "number"
                                                                        ? `#${clone.prStatus.number}`
                                                                        : ""}
                                                                    {clone.prStatus.title ? ` — ${clone.prStatus.title}` : ""}
                                                                </a>
                                                            )}
                                                        {clone.commitHash && clone.commitDescription && (
                                                            <div className="text-xs text-base-content/70 break-all">
                                                                <span className="font-mono">
                                                                    {clone.commitHash.slice(0, 12)}
                                                                </span>
                                                                <span className="mx-2">—</span>
                                                                <span>{clone.commitDescription}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {clone.isWorktree && (
                                                            <div className="badge badge-outline">worktree</div>
                                                        )}
                                                        {clone.isWorktree && (
                                                            <div
                                                                className={`badge badge-outline whitespace-nowrap ${
                                                                    clone.inUse ? "badge-error" : "badge-ghost"
                                                                }`}
                                                            >
                                                                {clone.inUse ? "in use" : "idle"}
                                                            </div>
                                                        )}
                                                        {typeof clone.hasChanges === "boolean" && (
                                                            <div
                                                                className={`badge badge-outline ${
                                                                    clone.hasChanges ? "badge-warning" : "badge-success"
                                                                }`}
                                                            >
                                                                {clone.hasChanges ? "changes" : "clean"}
                                                            </div>
                                                        )}
                                                        {clone.isWorktree && clone.prStatus && (
                                                            <div
                                                                className={`badge badge-outline whitespace-nowrap ${prBadgeClass(
                                                                    clone.prStatus.state,
                                                                )}`}
                                                            >
                                                                {prBadgeLabel(clone.prStatus)}
                                                            </div>
                                                        )}
                                                        {typeof clone.port === "number" && (
                                                            <div className="badge badge-success badge-outline">
                                                                port {clone.port}
                                                            </div>
                                                        )}
                                                        {clone.isWorktree && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline btn-sm"
                                                                onClick={() => {
                                                                    if (devLogsOpen) {
                                                                        setDevLogsTarget(null);
                                                                        return;
                                                                    }
                                                                    setDevLogsTarget({ key, path: clone.path });
                                                                    setDevLogs(null);
                                                                    setDevLogsMeta(null);
                                                                }}
                                                            >
                                                                {devLogsOpen ? "Hide logs" : "Show logs"}
                                                            </button>
                                                        )}
                                                        {showRunDev && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary btn-sm"
                                                                disabled={Boolean(startingDevKey)}
                                                                onClick={() => void startDevServer(clone.path, key)}
                                                            >
                                                                {isStarting && (
                                                                    <span className="loading loading-spinner loading-xs" />
                                                                )}
                                                                {isStarting ? "Starting" : "Run dev"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {devLogsOpen && (
                                                    <LogsPanel
                                                        title="Dev logs"
                                                        logs={devLogs}
                                                        emptyText="No logs yet. Click “Run dev” to start."
                                                        onRefresh={() => void refreshDevLogs(clone.path)}
                                                        badges={
                                                            devLogsMeta ? (
                                                                <>
                                                                    <div className="badge badge-outline">
                                                                        {devLogsMeta.exists ? "worktree" : "missing"}
                                                                    </div>
                                                                    {devLogsMeta.installing && (
                                                                        <div className="badge badge-warning badge-outline">
                                                                            installing
                                                                        </div>
                                                                    )}
                                                                    {devLogsMeta.running && (
                                                                        <div className="badge badge-success badge-outline">
                                                                            running
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : null
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="divider my-0" />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Production clone</div>
                                <span className="text-xs text-base-content/60">
                                    {project.productionClone?.exists ? "ready" : "not cloned"}
                                </span>
                            </div>

                            <div className="p-3 border border-base-300 rounded-xl bg-base-100/60 flex items-center justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                    {project.productionClone ? (
                                        <>
                                            <div className="font-mono text-xs break-all">{project.productionClone.path}</div>
                                            {project.productionClone.commitHash && project.productionClone.commitDescription && (
                                                <div className="text-xs text-base-content/70 break-all">
                                                    <span className="font-mono">
                                                        {project.productionClone.commitHash.slice(0, 12)}
                                                    </span>
                                                    <span className="mx-2">—</span>
                                                    <span>{project.productionClone.commitDescription}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-sm text-base-content/70">
                                            Production clone path will be created next to the clones folder.
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {project.productionClone && (
                                        <div
                                            className={`badge badge-outline whitespace-nowrap ${
                                                project.productionClone.inUse ? "badge-error" : "badge-ghost"
                                            }`}
                                        >
                                            {project.productionClone.inUse ? "in use" : "idle"}
                                        </div>
                                    )}
                                    {project.productionClone && typeof project.productionClone.hasChanges === "boolean" && (
                                        <div
                                            className={`badge badge-outline ${
                                                project.productionClone.hasChanges ? "badge-warning" : "badge-success"
                                            }`}
                                        >
                                            {project.productionClone.hasChanges ? "changes" : "clean"}
                                        </div>
                                    )}
                                    {project.productionClone && (
                                        <div className="badge badge-outline">
                                            {project.productionClone.exists ? "production" : "missing"}
                                        </div>
                                    )}
                                    {typeof project.productionClone?.port === "number" && (
                                        <div className="badge badge-success badge-outline">
                                            port {project.productionClone.port}
                                        </div>
                                    )}
                                    {typeof project.productionClone?.port === "number" && (
                                        <a
                                            className="btn btn-outline btn-sm"
                                            href={`${previewProtocol}://${previewHost}:${project.productionClone.port}/`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={Boolean(startingDevKey) || startingProduction}
                                        onClick={() => void startProductionServer()}
                                    >
                                        {startingProduction && <span className="loading loading-spinner loading-xs" />}
                                        {startingProduction ? "Starting" : "Run production"}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => {
                                            setProductionLogsOpen((prev) => !prev);
                                        }}
                                    >
                                        {productionLogsOpen ? "Hide logs" : "Show logs"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {productionLogsOpen && (
                            <LogsPanel
                                title="Production logs"
                                logs={productionLogs}
                                emptyText="No logs yet. Click “Run production” to start and clone if needed."
                                onRefresh={() => void refreshProductionLogs()}
                                badges={
                                    productionLogsMeta ? (
                                        <>
                                            <div className="badge badge-outline">
                                                {productionLogsMeta.exists ? "cloned" : "missing"}
                                            </div>
                                            {productionLogsMeta.installing && (
                                                <div className="badge badge-warning badge-outline">installing</div>
                                            )}
                                            {productionLogsMeta.running && (
                                                <div className="badge badge-success badge-outline">running</div>
                                            )}
                                        </>
                                    ) : null
                                }
                            />
                        )}

                        {previewTargets.length > 0 && previewUrl && (
                            <>
                                <div className="divider my-0" />

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold">Live preview</div>
                                            <div className="text-xs text-base-content/60 break-all">{previewUrl}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                className="select select-bordered select-sm"
                                                value={activePreviewKey ?? ""}
                                                onChange={(event) => setActivePreviewKey(event.target.value)}
                                            >
                                                {previewTargets.map((target) => {
                                                    const key = target.key;
                                                    return (
                                                        <option key={key} value={key}>
                                                            {target.label}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <a
                                                className="btn btn-outline btn-sm"
                                                href={previewUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open
                                            </a>
                                        </div>
                                    </div>

                                    <div className="w-full h-[70vh] border border-base-300 rounded-xl overflow-hidden bg-base-100">
                                        <iframe title="Project preview" src={previewUrl} className="w-full h-full" />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectDetails;
