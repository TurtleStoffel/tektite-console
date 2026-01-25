import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type RepositoriesPageProps = {
    drawerToggleId: string;
};

export function RepositoriesPage({ drawerToggleId }: RepositoriesPageProps) {
    const [repos, setRepos] = useState<RepositorySummary[]>([]);
    const [reposLoading, setReposLoading] = useState(true);
    const [reposError, setReposError] = useState<string | null>(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const fetchRepos = useCallback(async () => {
        setReposLoading(true);
        setReposError(null);
        console.info("Loading repositories from local DB...");
        try {
            const res = await fetch("/api/repositories");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load repositories.");
            }
            const list = Array.isArray(payload?.repositories)
                ? (payload.repositories as RepositorySummary[])
                : [];
            setRepos(list);
            console.info(`[repositories] loaded ${list.length} repositories.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load repositories.";
            setReposError(message);
            setRepos([]);
            console.error("[repositories] failed to load repositories.", error);
        } finally {
            setReposLoading(false);
        }
    }, []);

    const syncRepos = useCallback(async () => {
        setSyncLoading(true);
        setSyncError(null);
        setSyncMessage(null);
        console.info("[repositories] syncing repositories from GitHub...");
        try {
            const res = await fetch("/api/repositories/sync", { method: "POST" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to sync repositories.");
            }
            const inserted = typeof payload?.insertedCount === "number" ? payload.insertedCount : 0;
            const total = typeof payload?.total === "number" ? payload.total : 0;
            setSyncMessage(`Synced ${inserted} new repositories from ${total} GitHub repos.`);
            await fetchRepos();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to sync repositories.";
            setSyncError(message);
            console.error("[repositories] failed to sync repositories.", error);
        } finally {
            setSyncLoading(false);
        }
    }, [fetchRepos]);

    useEffect(() => {
        void fetchRepos();
    }, [fetchRepos]);

    return (
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Repositories</h1>
                    <p className="text-sm text-base-content/70">
                        Track the repos connected to your projects.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={syncRepos}
                        disabled={syncLoading}
                    >
                        {syncLoading ? "Syncing..." : "Sync from GitHub"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={fetchRepos}
                        disabled={reposLoading}
                    >
                        {reposLoading ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <div className="card bg-base-200 border border-base-300 shadow-md">
                <div className="card-body space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="card-title">All repositories</h2>
                            <p className="text-sm text-base-content/70">
                                Showing {repos.length} repositories from the local database.
                            </p>
                        </div>
                        {reposLoading && <span className="loading loading-spinner loading-sm" />}
                    </div>
                    {reposError && (
                        <div className="alert alert-error text-sm">
                            <span>{reposError}</span>
                        </div>
                    )}
                    {syncError && (
                        <div className="alert alert-error text-sm">
                            <span>{syncError}</span>
                        </div>
                    )}
                    {syncMessage && (
                        <div className="alert alert-success text-sm">
                            <span>{syncMessage}</span>
                        </div>
                    )}
                    {reposLoading ? (
                        <div className="text-sm text-base-content/70">Loading repositories...</div>
                    ) : repos.length === 0 ? (
                        <div className="text-sm text-base-content/70">
                            No repositories found yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {repos.map((repo) => {
                                return (
                                    <div
                                        key={repo.id}
                                        className="p-4 border border-base-300 rounded-xl bg-base-100/60"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <a
                                                    href={repo.url}
                                                    className="font-semibold link link-hover"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {repo.name}
                                                </a>
                                                <p className="text-sm text-base-content/70 break-all">
                                                    {repo.url}
                                                </p>
                                            </div>
                                            {repo.projectId && (
                                                <span className="badge badge-outline text-xs">
                                                    Linked
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

type RepositorySummary = {
    id: string;
    name: string;
    url: string;
    projectId: string | null;
};

export default RepositoriesPage;
