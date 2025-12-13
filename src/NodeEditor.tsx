import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
} from "reactflow";
import "reactflow/dist/style.css";

type NodeEditorProps = {
    drawerToggleId: string;
};

type OwnerSummary = {
    id: string;
    ownerType: "project" | "idea";
    name: string | null;
    description: string | null;
};

const initialNodes: Node[] = [
    {
        id: "start",
        type: "input",
        position: { x: 80, y: 120 },
        data: { label: "Start" },
    },
    {
        id: "step",
        position: { x: 340, y: 120 },
        data: { label: "Step" },
    },
    {
        id: "end",
        type: "output",
        position: { x: 600, y: 120 },
        data: { label: "End" },
    },
];

const initialEdges: Edge[] = [
    { id: "e-start-step", source: "start", target: "step" },
    { id: "e-step-end", source: "step", target: "end" },
];

export function NodeEditor({ drawerToggleId }: NodeEditorProps) {
    const flowId = "default";
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const nextNodeId = useRef(1);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [owners, setOwners] = useState<OwnerSummary[]>([]);
    const [ownersError, setOwnersError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState("");
    const [newIdeaDescription, setNewIdeaDescription] = useState("");

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((current) => addEdge(connection, current));
        },
        [setEdges],
    );

    const handleAddNode = useCallback(() => {
        const id = `node-${nextNodeId.current++}`;
        const sequence = nextNodeId.current - 1;
        setNodes((current) => [
            ...current,
            {
                id,
                position: { x: 160 + current.length * 30, y: 280 + (current.length % 4) * 80 },
                data: { label: `Node ${sequence}` },
            },
        ]);
    }, [setNodes]);

    const selectedNode = useMemo(
        () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
        [nodes, selectedNodeId],
    );

    const selectedOwnerId = useMemo(() => {
        const data = selectedNode?.data as any;
        return typeof data?.ownerId === "string" ? data.ownerId : "";
    }, [selectedNode]);

    const handleOwnerChange = useCallback(
        (ownerId: string) => {
            if (!selectedNodeId) return;
            setNodes((current) =>
                current.map((node) => {
                    if (node.id !== selectedNodeId) return node;
                    const data = node.data && typeof node.data === "object" ? node.data : {};
                    return {
                        ...node,
                        data: {
                            ...(data as any),
                            ownerId,
                        },
                    };
                }),
            );
        },
        [selectedNodeId, setNodes],
    );

    const refreshOwners = useCallback(async () => {
        setOwnersError(null);
        try {
            const res = await fetch("/api/owners");
            const payload = await res.json().catch(() => ({}));
            const list = Array.isArray(payload?.owners) ? (payload.owners as OwnerSummary[]) : [];
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load owners.");
            }
            setOwners(list);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load owners.";
            setOwnersError(message);
        }
    }, []);

    const handleCreateProject = useCallback(async () => {
        const name = newProjectName.trim();
        if (!name) return;
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || "Failed to create project.");
            }
            setNewProjectName("");
            await refreshOwners();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create project.";
            setOwnersError(message);
        }
    }, [newProjectName, refreshOwners]);

    const handleCreateIdea = useCallback(async () => {
        const description = newIdeaDescription.trim();
        if (!description) return;
        try {
            const res = await fetch("/api/ideas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || "Failed to create idea.");
            }
            setNewIdeaDescription("");
            await refreshOwners();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create idea.";
            setOwnersError(message);
        }
    }, [newIdeaDescription, refreshOwners]);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            setIsLoading(true);
            setSaveStatus("idle");
            try {
                const res = await fetch(`/api/flow/${flowId}`);
                const payload = await res.json().catch(() => ({}));
                const state = payload?.state;
                if (res.ok && state && Array.isArray(state.nodes) && Array.isArray(state.edges)) {
                    setNodes(state.nodes);
                    setEdges(state.edges);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void refreshOwners();
        load();

        return () => {
            isMounted = false;
        };
    }, [refreshOwners, setEdges, setNodes]);

    useEffect(() => {
        if (isLoading) return;

        setSaveStatus("saving");
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(`/api/flow/${flowId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nodes, edges }),
                });
                if (!res.ok) {
                    setSaveStatus("error");
                    return;
                }
                setSaveStatus("saved");
            } catch {
                setSaveStatus("error");
            }
        }, 600);

        return () => window.clearTimeout(timer);
    }, [edges, isLoading, nodes]);

    useEffect(() => {
        if (isLoading) return;
        const fallbackOwnerId = owners[0]?.id;
        if (!fallbackOwnerId) return;

        const hasMissingOwner = nodes.some((node) => {
            const data = node.data as any;
            return typeof data?.ownerId !== "string" || !data.ownerId;
        });
        if (!hasMissingOwner) return;

        setNodes((current) =>
            current.map((node) => {
                const data = node.data as any;
                if (typeof data?.ownerId === "string" && data.ownerId) return node;
                const nextData = node.data && typeof node.data === "object" ? node.data : {};
                return {
                    ...node,
                    data: {
                        ...(nextData as any),
                        ownerId: fallbackOwnerId,
                    },
                };
            }),
        );
    }, [isLoading, nodes, owners, setNodes]);

    const miniMapStyle = useMemo(() => ({ height: 120 }), []);

    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="max-w-6xl w-full mx-auto px-8 pt-8 pb-4 flex items-start justify-between gap-4">
                <div className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Node Editor</h1>
                    <p className="text-base-content/80">A simple React Flow canvas for node-based editing.</p>
                    <div className="flex items-center gap-2">
                        <Link to="/" className="btn btn-outline btn-sm">
                            Back to grid
                        </Link>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleAddNode}>
                            Add node
                        </button>
                        <span className="text-sm text-base-content/60">
                            {saveStatus === "saving" && "Saving…"}
                            {saveStatus === "saved" && "Saved"}
                            {saveStatus === "error" && "Save failed"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <div className="flex-1 w-full">
                <div className="max-w-6xl w-full mx-auto px-8 pb-8 h-full">
                    <div className="card bg-base-200 border border-base-300 shadow-md h-[70vh] min-h-[520px]">
                        <div className="card-body p-0">
                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center gap-2 text-sm text-base-content/70">
                                    <span className="loading loading-spinner loading-sm" />
                                    <span>Loading editor…</span>
                                </div>
                            ) : (
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    onConnect={onConnect}
                                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                                    onPaneClick={() => setSelectedNodeId(null)}
                                    fitView
                                >
                                    <MiniMap style={miniMapStyle} zoomable pannable />
                                    <Controls />
                                    <Background />
                                </ReactFlow>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 card bg-base-200 border border-base-300 shadow-md">
                        <div className="card-body space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg">Node owner</h3>
                                    <p className="text-sm text-base-content/70">
                                        Select a node, then assign it to a Project or Idea.
                                    </p>
                                </div>
                                <button type="button" className="btn btn-outline btn-sm" onClick={refreshOwners}>
                                    Refresh owners
                                </button>
                            </div>

                            {ownersError && (
                                <div className="alert alert-error">
                                    <span>{ownersError}</span>
                                </div>
                            )}

                            {!selectedNode ? (
                                <div className="text-sm text-base-content/70">No node selected.</div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="text-sm">
                                        <span className="font-semibold">Selected node:</span>{" "}
                                        <span className="text-base-content/80">{selectedNode.id}</span>
                                    </div>
                                    <label className="form-control w-full max-w-md">
                                        <div className="label">
                                            <span className="label-text">Owner</span>
                                        </div>
                                        <select
                                            className="select select-bordered w-full"
                                            value={selectedOwnerId}
                                            onChange={(event) => handleOwnerChange(event.target.value)}
                                        >
                                            {owners.map((owner) => {
                                                const label =
                                                    owner.ownerType === "project"
                                                        ? `Project: ${owner.name ?? "Untitled"}`
                                                        : `Idea: ${owner.description ?? "Untitled"}`;
                                                return (
                                                    <option key={owner.id} value={owner.id}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </label>
                                </div>
                            )}

                            <div className="divider my-0" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold">New project</h4>
                                    <input
                                        className="input input-bordered w-full"
                                        placeholder="Project name"
                                        value={newProjectName}
                                        onChange={(event) => setNewProjectName(event.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={handleCreateProject}
                                        disabled={!newProjectName.trim()}
                                    >
                                        Create project
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-semibold">New idea</h4>
                                    <input
                                        className="input input-bordered w-full"
                                        placeholder="Idea description"
                                        value={newIdeaDescription}
                                        onChange={(event) => setNewIdeaDescription(event.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={handleCreateIdea}
                                        disabled={!newIdeaDescription.trim()}
                                    >
                                        Create idea
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NodeEditor;
