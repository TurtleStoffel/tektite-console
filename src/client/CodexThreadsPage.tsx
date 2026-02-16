import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Markdown } from "./Markdown";
import { getErrorMessage } from "./utils/errors";

type CodexThreadsPageProps = {
    drawerToggleId: string;
};

type CodexThreadSummary = {
    id: string;
    path: string;
    relativePath: string;
    sizeBytes: number;
    updatedAt: string;
};

type CodexThreadAnalysis = {
    markdown: string;
};

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CodexThreadsPage({ drawerToggleId }: CodexThreadsPageProps) {
    const [selectedThreadPath, setSelectedThreadPath] = useState<string | null>(null);

    const fetchThreads = useCallback(async () => {
        console.info("[codex-threads] loading thread list...");
        const res = await fetch("/api/codex-threads");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load Codex threads.");
        }
        const threads = Array.isArray(payload?.data) ? (payload.data as CodexThreadSummary[]) : [];
        console.info("[codex-threads] loaded thread list", { count: threads.length });
        return threads;
    }, []);

    const {
        data: threads = [],
        isLoading,
        isFetching,
        error: threadsErrorRaw,
        refetch,
    } = useQuery<CodexThreadSummary[]>({
        queryKey: ["codex-threads"],
        queryFn: fetchThreads,
    });

    const analyzeMutation = useMutation<CodexThreadAnalysis, Error, { threadPath: string }>({
        mutationFn: async ({ threadPath }) => {
            console.info("[codex-threads] analyzing thread", { threadPath });
            const res = await fetch("/api/codex-threads/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ threadPath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to analyze Codex thread.");
            }
            const data = payload?.data as CodexThreadAnalysis;
            return data;
        },
        onSuccess: (_data, variables) => {
            setSelectedThreadPath(variables.threadPath);
        },
    });

    const threadsError = getErrorMessage(threadsErrorRaw);
    const analyzeError = getErrorMessage(analyzeMutation.error);
    const analysisMarkdown = analyzeMutation.data?.markdown ?? "";

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 p-8">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Codex Threads</h1>
                    <p className="text-sm text-base-content/70">
                        Browse thread logs in <code>~/.codex/sessions</code> and run token-usage
                        analysis.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void refetch()}
                        disabled={isLoading || isFetching}
                    >
                        {isLoading || isFetching ? "Refreshing..." : "Refresh"}
                    </button>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {threadsError && (
                <div className="alert alert-error">
                    <span>{threadsError}</span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <span className="loading loading-spinner loading-lg" />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="card border border-base-300 bg-base-200 shadow-md">
                            <div className="card-body">
                                <h2 className="card-title">No thread logs found</h2>
                                <p className="text-sm text-base-content/70">
                                    No `.jsonl` files were discovered in{" "}
                                    <code>~/.codex/sessions</code>.
                                </p>
                            </div>
                        </div>
                    ) : (
                        threads.map((thread) => {
                            const isAnalyzingThisThread =
                                analyzeMutation.isPending &&
                                analyzeMutation.variables?.threadPath === thread.path;
                            return (
                                <article
                                    key={thread.path}
                                    className="card border border-base-300 bg-base-200 shadow-sm"
                                >
                                    <div className="card-body gap-3">
                                        <div>
                                            <h2 className="card-title text-base">{thread.id}</h2>
                                            <p className="text-xs text-base-content/70 break-all">
                                                {thread.relativePath}
                                            </p>
                                        </div>
                                        <div className="text-xs text-base-content/70">
                                            Size: {formatBytes(thread.sizeBytes)}
                                        </div>
                                        <div className="text-xs text-base-content/70">
                                            Updated: {new Date(thread.updatedAt).toLocaleString()}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm w-fit"
                                            disabled={analyzeMutation.isPending}
                                            onClick={() =>
                                                analyzeMutation.mutate({ threadPath: thread.path })
                                            }
                                        >
                                            {isAnalyzingThisThread ? "Analyzing..." : "Analyze"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })
                    )}
                </section>

                <section className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body space-y-3">
                        <h2 className="card-title">Analysis</h2>
                        {selectedThreadPath ? (
                            <p className="text-xs text-base-content/60 break-all">
                                Selected: {selectedThreadPath}
                            </p>
                        ) : (
                            <p className="text-sm text-base-content/70">
                                Choose a thread and click Analyze.
                            </p>
                        )}

                        {analyzeError && (
                            <div className="alert alert-error">
                                <span>{analyzeError}</span>
                            </div>
                        )}

                        {analysisMarkdown ? (
                            <Markdown markdown={analysisMarkdown} className="space-y-3 text-sm" />
                        ) : null}
                    </div>
                </section>
            </div>
        </div>
    );
}
