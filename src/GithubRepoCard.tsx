import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RepositoriesList from "./RepositoriesList";
import type { RepositorySummary } from "./types/repositories";

export function GithubRepoCard() {
    const [repos, setRepos] = useState<RepositorySummary[]>([]);
    const [reposLoading, setReposLoading] = useState(true);
    const [reposError, setReposError] = useState<string | null>(null);

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

    useEffect(() => {
        void fetchRepos();
    }, [fetchRepos]);

    return (
        <div className="card bg-base-200 border border-base-300 shadow-md text-left">
            <div className="card-body space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="card-title text-lg">GitHub repositories</h2>
                        <p className="text-sm text-base-content/70">
                            Showing {repos.length} repositories from the local database.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {reposLoading && <span className="loading loading-spinner loading-xs" />}
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={fetchRepos}
                            disabled={reposLoading}
                        >
                            {reposLoading ? "Refreshing..." : "Refresh"}
                        </button>
                        <Link to="/repositories" className="btn btn-outline btn-sm">
                            View all
                        </Link>
                    </div>
                </div>
                {reposError && (
                    <div className="alert alert-error text-sm">
                        <span>{reposError}</span>
                    </div>
                )}
                {reposLoading ? (
                    <div className="text-sm text-base-content/70">Loading repositories...</div>
                ) : repos.length === 0 ? (
                    <div className="text-sm text-base-content/70">No repositories loaded yet.</div>
                ) : (
                    <RepositoriesList repos={repos} />
                )}
            </div>
        </div>
    );
}

export default GithubRepoCard;
