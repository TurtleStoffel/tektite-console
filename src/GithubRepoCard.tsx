import { useCallback, useState } from "react";
import type { GithubRepo } from "./types/github";

export function GithubRepoCard() {
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [reposError, setReposError] = useState<string | null>(null);

    const fetchRepos = useCallback(async () => {
        setReposLoading(true);
        setReposError(null);
        console.info("Loading GitHub repositories...");
        try {
            const res = await fetch("/api/github/repos");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load repositories.");
            }
            const list = Array.isArray(payload?.repos) ? (payload.repos as GithubRepo[]) : [];
            setRepos(list);
            console.info(`Loaded ${list.length} GitHub repositories.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load repositories.";
            setReposError(message);
            setRepos([]);
            console.error("Failed to load GitHub repositories.", error);
        } finally {
            setReposLoading(false);
        }
    }, []);

    return (
        <div className="card bg-base-200 border border-base-300 shadow-md text-left">
            <div className="card-body space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="card-title text-lg">GitHub repositories</h2>
                        <p className="text-sm text-base-content/70">
                            Load your connected GitHub repos to browse them here.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60">{repos.length} loaded</span>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={fetchRepos}
                            disabled={reposLoading}
                        >
                            {reposLoading ? "Loading repos..." : "Load repos"}
                        </button>
                    </div>
                </div>
                {reposError && (
                    <div className="alert alert-error text-sm">
                        <span>{reposError}</span>
                    </div>
                )}
                {reposLoading ? (
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <span className="loading loading-spinner loading-sm" />
                        <span>Loading repositories...</span>
                    </div>
                ) : repos.length === 0 ? (
                    <div className="text-sm text-base-content/70">No repositories loaded yet.</div>
                ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                        {repos.map((repo) => {
                            const label = repo.owner?.login
                                ? `${repo.owner.login}/${repo.name}`
                                : repo.name;
                            return (
                                <div
                                    key={repo.url}
                                    className="p-3 border border-base-300 rounded-xl bg-base-100/60"
                                >
                                    <a
                                        href={repo.url}
                                        className="font-semibold link link-hover"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {label}
                                    </a>
                                    {repo.description && (
                                        <p className="text-sm text-base-content/70 mt-2">
                                            {repo.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GithubRepoCard;
