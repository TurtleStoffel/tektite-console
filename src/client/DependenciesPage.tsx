import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type DependenciesPageProps = {
    drawerToggleId: string;
};

type DependencyNode = {
    id: string;
    label: string;
    outgoingCount: number;
    incomingCount: number;
};

type DependencyEdge = {
    from: string;
    to: string;
};

type DependencyGraphResponse = {
    data: {
        nodes: DependencyNode[];
        edges: DependencyEdge[];
    };
};

type PositionedNode = DependencyNode & {
    x: number;
    y: number;
};

const SVG_WIDTH = 1400;
const SVG_HEIGHT = 900;

export function DependenciesPage({ drawerToggleId }: DependenciesPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialPath = searchParams.get("path")?.trim() ?? "";
    const [inputPath, setInputPath] = useState(initialPath);
    const graphUrl = useMemo(() => {
        if (!initialPath) {
            return null;
        }
        const params = new URLSearchParams({ path: initialPath });
        return `/api/dependencies/graph?${params.toString()}`;
    }, [initialPath]);
    const [graphData, setGraphData] = useState<DependencyGraphResponse["data"] | null>(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;

        if (!graphUrl) {
            setGraphData(null);
            setLoadError(null);
            setIsLoadingGraph(false);
            setSelectedModuleId(null);
            return;
        }

        const loadGraph = async () => {
            setIsLoadingGraph(true);
            setLoadError(null);
            const response = await fetch(graphUrl);
            if (!response.ok) {
                let errorMessage = "Failed to load dependency graph.";
                const contentType = response.headers.get("Content-Type");
                if (contentType?.includes("application/json")) {
                    const body = (await response.json()) as { error?: string };
                    if (body.error) {
                        errorMessage = body.error;
                    }
                }
                throw new Error(errorMessage);
            }
            const payload = (await response.json()) as DependencyGraphResponse;
            if (!isCancelled) {
                setGraphData(payload.data);
                const firstNodeId = payload.data.nodes[0]?.id ?? null;
                setSelectedModuleId((current) => {
                    if (current && payload.data.nodes.some((node) => node.id === current)) {
                        return current;
                    }
                    return firstNodeId;
                });
                setIsLoadingGraph(false);
            }
        };

        void loadGraph().catch((error: unknown) => {
            if (isCancelled) {
                return;
            }
            setIsLoadingGraph(false);
            setGraphData(null);
            setLoadError(
                error instanceof Error ? error.message : "Failed to load dependency graph.",
            );
        });

        return () => {
            isCancelled = true;
        };
    }, [graphUrl]);

    const selectedModule = useMemo(() => {
        if (!graphData || !selectedModuleId) {
            return null;
        }
        return graphData.nodes.find((node) => node.id === selectedModuleId) ?? null;
    }, [graphData, selectedModuleId]);

    const moduleRelations = useMemo(() => {
        if (!graphData || !selectedModuleId) {
            return { dependencies: [] as string[], dependers: [] as string[] };
        }

        const dependencies = graphData.edges
            .filter((edge) => edge.from === selectedModuleId)
            .map((edge) => edge.to)
            .sort((a, b) => a.localeCompare(b));
        const dependers = graphData.edges
            .filter((edge) => edge.to === selectedModuleId)
            .map((edge) => edge.from)
            .sort((a, b) => a.localeCompare(b));
        return { dependencies, dependers };
    }, [graphData, selectedModuleId]);

    const positionedNodes = useMemo(() => {
        if (!graphData) {
            return [] as PositionedNode[];
        }
        const nodeCount = Math.max(1, graphData.nodes.length);
        const centerX = SVG_WIDTH / 2;
        const centerY = SVG_HEIGHT / 2;
        const radius = Math.max(180, Math.min(SVG_WIDTH, SVG_HEIGHT) * 0.35);

        return graphData.nodes.map((node, index) => {
            const angle = (index / nodeCount) * Math.PI * 2;
            return {
                ...node,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
            };
        });
    }, [graphData]);

    const nodeById = useMemo(() => {
        return new Map(positionedNodes.map((node) => [node.id, node]));
    }, [positionedNodes]);

    const selectedEdgeSet = useMemo(() => {
        if (!selectedModuleId || !graphData) {
            return new Set<string>();
        }
        const relatedEdgeIds = graphData.edges
            .filter((edge) => edge.from === selectedModuleId || edge.to === selectedModuleId)
            .map((edge) => `${edge.from}->${edge.to}`);
        return new Set(relatedEdgeIds);
    }, [graphData, selectedModuleId]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextPath = inputPath.trim();
        if (!nextPath) {
            setSearchParams({});
            return;
        }
        setSearchParams({ path: nextPath });
    };

    return (
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
            <section className="card border border-base-300 bg-base-100">
                <div className="card-body gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="card-title">Dependency Graph</h1>
                            <p className="text-sm text-base-content/70">
                                Generate a dependency graph using Madge from a local path.
                            </p>
                        </div>
                        <label
                            htmlFor={drawerToggleId}
                            className="btn btn-sm btn-outline lg:hidden"
                        >
                            Entities
                        </label>
                    </div>
                    <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder="/Users/you/path/to/repository"
                            value={inputPath}
                            onChange={(event) => setInputPath(event.target.value)}
                        />
                        <button type="submit" className="btn btn-primary md:w-40">
                            Generate
                        </button>
                    </form>
                </div>
            </section>

            {!graphUrl ? (
                <section className="alert">
                    <span>Provide a local path and generate a graph.</span>
                </section>
            ) : (
                <section className="card border border-base-300 bg-base-100">
                    <div className="card-body">
                        <div className="mb-2 text-xs text-base-content/70">
                            Source path: <code>{initialPath}</code>
                        </div>
                        {isLoadingGraph && <span className="loading loading-spinner loading-lg" />}
                        {loadError ? (
                            <div className="alert alert-error">
                                <span>{loadError}</span>
                            </div>
                        ) : null}
                        {graphData ? (
                            <div className="space-y-4">
                                <div className="text-xs text-base-content/70">
                                    Modules: {graphData.nodes.length} | Edges:{" "}
                                    {graphData.edges.length}
                                </div>
                                <label className="form-control w-full max-w-xl">
                                    <span className="label-text text-xs text-base-content/70">
                                        Highlight module
                                    </span>
                                    <select
                                        className="select select-bordered select-sm"
                                        value={selectedModuleId ?? ""}
                                        onChange={(event) =>
                                            setSelectedModuleId(event.target.value || null)
                                        }
                                    >
                                        {graphData.nodes.map((node) => (
                                            <option key={node.id} value={node.id}>
                                                {node.id}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="overflow-auto rounded-lg border border-base-300 bg-base-200/30">
                                    <svg
                                        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                                        className="min-h-[560px] w-full"
                                        role="img"
                                        aria-label="Repository dependency graph"
                                    >
                                        <defs>
                                            <marker
                                                id="dependency-arrow"
                                                markerWidth="8"
                                                markerHeight="8"
                                                refX="7"
                                                refY="4"
                                                orient="auto-start-reverse"
                                            >
                                                <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
                                            </marker>
                                        </defs>
                                        {graphData.edges.map((edge) => {
                                            const from = nodeById.get(edge.from);
                                            const to = nodeById.get(edge.to);
                                            if (!from || !to) {
                                                return null;
                                            }
                                            const isHighlighted = selectedEdgeSet.has(
                                                `${edge.from}->${edge.to}`,
                                            );
                                            return (
                                                <line
                                                    key={`${edge.from}-${edge.to}`}
                                                    x1={from.x}
                                                    y1={from.y}
                                                    x2={to.x}
                                                    y2={to.y}
                                                    stroke="currentColor"
                                                    strokeOpacity={isHighlighted ? 0.85 : 0.2}
                                                    strokeWidth={isHighlighted ? 2.5 : 1}
                                                    markerEnd="url(#dependency-arrow)"
                                                    className={
                                                        isHighlighted
                                                            ? "text-primary"
                                                            : "text-base-content"
                                                    }
                                                />
                                            );
                                        })}
                                        {positionedNodes.map((node) => {
                                            const isSelected = node.id === selectedModuleId;
                                            return (
                                                <g key={node.id}>
                                                    <circle
                                                        cx={node.x}
                                                        cy={node.y}
                                                        r={isSelected ? 18 : 12}
                                                        className={
                                                            isSelected
                                                                ? "fill-primary"
                                                                : "fill-base-content/70"
                                                        }
                                                    />
                                                    <text
                                                        x={node.x + 16}
                                                        y={node.y + 4}
                                                        className="fill-base-content text-[11px]"
                                                    >
                                                        {node.label}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                                <div className="rounded-lg border border-base-300 bg-base-200/30 p-4">
                                    {selectedModule ? (
                                        <div className="space-y-1 text-sm">
                                            <div className="font-semibold">
                                                {selectedModule.label}
                                            </div>
                                            <div className="text-xs text-base-content/70">
                                                {selectedModule.id}
                                            </div>
                                            <div className="text-xs text-base-content/70">
                                                outgoing: {moduleRelations.dependencies.length} |
                                                incoming: {moduleRelations.dependers.length}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-base-content/70">
                                            Click a node to inspect the module.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            )}
        </main>
    );
}
