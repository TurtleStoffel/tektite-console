import { useEffect, useState } from "react";
import type { GithubRepo } from "./types/github";

type MainContentProps = {
    drawerToggleId: string;
    onRepoSelected?: (url: string | null) => void;
};

export function MainContent({ drawerToggleId, onRepoSelected }: MainContentProps) {
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingSelection, setSavingSelection] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
    const [selectionsByCell, setSelectionsByCell] = useState<Record<number, string>>({});

    useEffect(() => {
        const fetchSelection = async () => {
            try {
                const response = await fetch("/api/github/selection");
                const payload = await response.json().catch(() => ({} as any));
                if (response.ok && payload.selection && typeof payload.selection === "object") {
                    const selectionMap: Record<number, string> = {};
                    Object.entries(payload.selection).forEach(([cellKey, url]: [string, unknown]) => {
                        const cellNum = Number(cellKey);
                        if (Number.isInteger(cellNum) && typeof url === "string") {
                            selectionMap[cellNum] = url;
                        }
                    });
                    setSelectionsByCell(selectionMap);
                    if (activeCell && selectionMap[activeCell]) {
                        setSelectedRepoUrl(selectionMap[activeCell]);
                        onRepoSelected?.(selectionMap[activeCell]);
                    } else if (activeCell) {
                        setSelectedRepoUrl(null);
                        onRepoSelected?.(null);
                    }
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unable to read your saved repository selection.";
                setError(message);
            }
        };

        fetchSelection();
    }, [activeCell, onRepoSelected]);

    const handleCellClick = async (cell: number) => {
        setActiveCell(cell);
        setLoading(true);
        setError(null);
        setSelectedRepoUrl(selectionsByCell[cell] ?? null);
        onRepoSelected?.(selectionsByCell[cell] ?? null);

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

    const handleRepoSelect = async (repoUrl: string) => {
        if (!activeCell) return;

        setSelectedRepoUrl(repoUrl);
        setSelectionsByCell((prev) => ({ ...prev, [activeCell]: repoUrl }));
        onRepoSelected?.(repoUrl);
        setSavingSelection(true);
        setError(null);

        try {
            const response = await fetch("/api/github/selection", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cell: activeCell, url: repoUrl }),
            });

            const payload = await response.json().catch(() => {
                throw new Error("Server returned an unreadable response.");
            });

            if (!response.ok) {
                throw new Error(payload.error || "Failed to save repository selection.");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unable to store your repository selection.";
            setError(message);
        } finally {
            setSavingSelection(false);
        }
    };

    const cells = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <div className="flex items-center justify-between">
                <header className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Grid Layout</h1>
                    <p className="text-base-content/80">
                        A 3 × 4 grid of cards, ready for whatever content you want to drop in.
                    </p>
                </header>
                <label htmlFor={drawerToggleId} className="btn btn-outline lg:hidden">
                    Menu
                </label>
            </div>

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
                            {selectionsByCell[cell] ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-base-content/60">Selected repository</p>
                                    <a
                                        href={selectionsByCell[cell]}
                                        className="link link-hover break-all"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {selectionsByCell[cell]}
                                    </a>
                                </div>
                            ) : (
                                <p className="text-sm text-base-content/70">
                                    Click to load repos, then choose one to pin here.
                                </p>
                            )}
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

                    <div className="flex items-center gap-3 text-sm text-base-content/70">
                        <span className="font-semibold">Selected URL (active cell):</span>
                        {selectedRepoUrl ? (
                            <a
                                href={selectedRepoUrl}
                                className="link link-hover break-all"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {selectedRepoUrl}
                            </a>
                        ) : (
                            <span className="text-base-content/60">None selected for this cell.</span>
                        )}
                        {savingSelection && <span className="loading loading-spinner loading-xs" />}
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
                                const isSelected = selectedRepoUrl === repo.url;
                                return (
                                    <div
                                        key={repo.url}
                                        className={`p-3 border rounded-xl space-y-2 transition-colors ${
                                            isSelected ? "border-primary bg-primary/10" : "border-base-300 bg-base-100/60"
                                        }`}
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
                                            <div className="flex items-center gap-2">
                                                <span className="badge badge-outline capitalize">
                                                    {repo.visibility || "unknown"}
                                                </span>
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => handleRepoSelect(repo.url)}
                                                    disabled={savingSelection}
                                                >
                                                    {isSelected ? "Selected" : "Select"}
                                                </button>
                                            </div>
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

export default MainContent;
