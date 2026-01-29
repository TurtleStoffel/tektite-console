import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import RepositoriesList from "./RepositoriesList";
import type { RepositorySummary } from "./types/repositories";
import { getErrorMessage } from "./utils/errors";

type RepositoriesPageProps = {
    drawerToggleId: string;
};

export function RepositoriesPage({ drawerToggleId }: RepositoriesPageProps) {
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const fetchRepos = useCallback(async () => {
        console.info("Loading repositories from local DB...");
        const res = await fetch("/api/repositories");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load repositories.");
        }
        const list = Array.isArray(payload?.data)
            ? (payload.data as RepositorySummary[])
            : [];
        console.info(`[repositories] loaded ${list.length} repositories.`);
        return list;
    }, []);

    const {
        data: repos = [],
        isLoading: reposLoading,
        isFetching: reposFetching,
        error: reposErrorRaw,
        refetch: refetchRepos,
    } = useQuery<RepositorySummary[]>({
        queryKey: ["repositories"],
        queryFn: fetchRepos,
    });

    const syncReposMutation = useMutation<{ inserted: number; total: number }, Error, void>({
        mutationFn: async () => {
            console.info("[repositories] syncing repositories from GitHub...");
            const res = await fetch("/api/repositories/sync", { method: "POST" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to sync repositories.");
            }
            return {
                inserted: typeof payload?.insertedCount === "number" ? payload.insertedCount : 0,
                total: typeof payload?.total === "number" ? payload.total : 0,
            };
        },
        onSuccess: async (result: { inserted: number; total: number }) => {
            setSyncMessage(
                `Synced ${result.inserted} new repositories from ${result.total} GitHub repos.`,
            );
            await queryClient.invalidateQueries({ queryKey: ["repositories"] });
        },
    });

    const reposError = getErrorMessage(reposErrorRaw);
    const syncError = getErrorMessage(syncReposMutation.error);
    const syncLoading = syncReposMutation.isPending;
    const handleSyncRepos = useCallback(() => {
        setSyncMessage(null);
        syncReposMutation.mutate();
    }, [syncReposMutation]);

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
                        onClick={handleSyncRepos}
                        disabled={syncLoading}
                    >
                        {syncLoading ? "Syncing..." : "Sync from GitHub"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void refetchRepos()}
                        disabled={reposLoading || reposFetching}
                    >
                        {reposLoading || reposFetching ? "Refreshing..." : "Refresh"}
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
                        <RepositoriesList repos={repos} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default RepositoriesPage;
