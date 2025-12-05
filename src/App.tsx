import { useState } from "react";
import type { GithubRepo } from "./types/github";
import "./index.css";

export function App() {
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCellClick = async (cell: number) => {
        setActiveCell(cell);
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/github/repos");
            const payload = await response.json().catch(() => {
                throw new Error("Server returned an unreadable response.");
            });

            if (!response.ok) {
                throw new Error(payload.error || "Failed to load repositories from the server.");
            }

            setRepos(Array.isArray(payload.repos) ? payload.repos : []);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Something went wrong fetching repositories.";
            setError(message);
            setRepos([]);
        } finally {
            setLoading(false);
        }
    };

    const cells = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <header className="space-y-2">
                <h1 className="text-5xl font-bold leading-tight">Grid Layout</h1>
                <p className="text-base-content/80">
                    A 3 × 4 grid of cards, ready for whatever content you want to drop in.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cells.map((cell) => (
                    <div
                        key={cell}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCellClick(cell)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleCellClick(cell);
                            }
                        }}
                        className="card bg-base-200 border border-base-300 shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60"
                    >
                        <div className="card-body text-left space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="badge badge-outline">Cell {cell}</span>
                                <span className="text-base-content/60">Ready</span>
                            </div>
                            <h2 className="card-title">Grid Item {cell}</h2>
                            <p className="text-sm text-base-content/70">
                                Placeholder for upcoming instructions and content.
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card bg-base-200 border border-base-300 shadow-md">
                <div className="card-body space-y-4 text-left">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-base-content/60">Connected via gh CLI</p>
                            <h2 className="card-title">Your GitHub repositories</h2>
                        </div>
                        <div className="badge badge-outline">
                            {activeCell ? `Loaded from cell ${activeCell}` : "Click a cell"}
                        </div>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-base-content/70">
                            <span className="loading loading-spinner loading-sm" />
                            <span>Contacting backend&hellip;</span>
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-error">
                            <span className="font-semibold">Error:</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && !error && repos.length === 0 && (
                        <p className="text-sm text-base-content/70">
                            Click any cell above to pull your repositories from GitHub using the gh CLI.
                        </p>
                    )}

                    {!loading && !error && repos.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {repos.map((repo) => {
                                const label = repo.owner?.login ? `${repo.owner.login}/${repo.name}` : repo.name;
                                return (
                                    <div
                                        key={repo.url}
                                        className="p-3 border border-base-300 rounded-xl bg-base-100/60 space-y-2"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <a
                                                href={repo.url}
                                                className="font-semibold link link-hover"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {label}
                                            </a>
                                            <span className="badge badge-outline capitalize">
                                                {repo.visibility || "unknown"}
                                            </span>
                                        </div>
                                        {repo.description && (
                                            <p className="text-sm text-base-content/70">{repo.description}</p>
                                        )}
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

export default App;
