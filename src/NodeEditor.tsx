import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactFlow, {
    addEdge,
    Background,
    type Connection,
    Controls,
    type Edge,
    MiniMap,
    type Node,
    useEdgesState,
    useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { OwnedNode } from "./OwnedNode";
import type { GithubRepo } from "./types/github";

type NodeEditorProps = {
    drawerToggleId: string;
};

type OwnerSummary = {
    id: string;
    ownerType: "project";
    name: string | null;
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
    const navigate = useNavigate();
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
    const [newProjectUrl, setNewProjectUrl] = useState("");
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [reposError, setReposError] = useState<string | null>(null);
    const [projectMenu, setProjectMenu] = useState<{
        projectId: string;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        if (!projectMenu) return;

        const handlePointerDown = () => setProjectMenu(null);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setProjectMenu(null);
        };

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [projectMenu]);

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
        () => (selectedNodeId ? (nodes.find((node) => node.id === selectedNodeId) ?? null) : null),
        [nodes, selectedNodeId],
    );

    const selectedOwnerId = useMemo(() => {
        const data = selectedNode?.data as any;
        return typeof data?.ownerId === "string" ? data.ownerId : "";
    }, [selectedNode]);

    const ownersById = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);

    const projects = useMemo(
        () => owners.filter((owner) => owner.ownerType === "project"),
        [owners],
    );

    const renderNodes = useMemo(() => {
        const clamp = (value: number, min: number, max: number) =>
            Math.min(max, Math.max(min, value));

        return nodes.map((node) => {
            const data = node.data as any;
            const ownerId = typeof data?.ownerId === "string" ? data.ownerId : "";
            const owner = ownerId ? ownersById.get(ownerId) : undefined;
            const displayOwnerType = owner?.ownerType ?? null;
            const displayProjectName =
                displayOwnerType === "project" ? (owner?.name ?? null) : null;

            const label = typeof data?.label === "string" ? data.label : "Node";
            const widthHint = Math.max(label.length, (displayProjectName ?? "").length);
            const widthCh = clamp(Math.ceil(widthHint * 0.75) + 12, 28, 64);

            return {
                ...node,
                type: node.type ?? "default",
                style: {
                    ...(node.style ?? {}),
                    width: `${widthCh}ch`,
                },
                data: {
                    ...(node.data as any),
                    displayOwnerType,
                    displayProjectName,
                },
            } satisfies Node;
        });
    }, [nodes, ownersById]);

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

    const handleOwnerChange = useCallback(
        (ownerId: string) => {
            if (!selectedNodeId) return;
            setNodes((current) =>
                current.map((node) => {
                    if (node.id !== selectedNodeId) return node;
                    const data = node.data && typeof node.data === "object" ? node.data : {};
                    const nextData = { ...(data as any) };
                    if (!ownerId) {
                        delete nextData.ownerId;
                    } else {
                        nextData.ownerId = ownerId;
                    }
                    return {
                        ...node,
                        data: {
                            ...nextData,
                        },
                    };
                }),
            );
        },
        [selectedNodeId, setNodes],
    );

    const handleCreateProject = useCallback(async () => {
        const name = newProjectName.trim();
        const url = newProjectUrl.trim();
        if (!name || !url) return;
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, url }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || "Failed to create project.");
            }
            setNewProjectName("");
            setNewProjectUrl("");
            await refreshOwners();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create project.";
            setOwnersError(message);
        }
    }, [newProjectName, newProjectUrl, refreshOwners]);

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

    const miniMapStyle = useMemo(() => ({ height: 120 }), []);
    const nodeTypes = useMemo(
        () => ({
            default: OwnedNode,
            input: OwnedNode,
            output: OwnedNode,
        }),
        [],
    );

    const fetchRepos = useCallback(async () => {
        setReposLoading(true);
        setReposError(null);
        try {
            const res = await fetch("/api/github/repos");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load repositories.");
            }
            setRepos(Array.isArray(payload?.repos) ? (payload.repos as GithubRepo[]) : []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load repositories.";
            setReposError(message);
            setRepos([]);
        } finally {
            setReposLoading(false);
        }
    }, []);

    const handleRepoSelect = useCallback(
        (repo: GithubRepo) => {
            setNewProjectUrl(repo.url);
            setNewProjectName((current) => {
                if (current.trim()) return current;
                return repo.owner?.login ? `${repo.owner.login}/${repo.name}` : repo.name;
            });
        },
        [setNewProjectName],
    );

    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="max-w-6xl w-full mx-auto px-8 pt-8 pb-4 flex items-start justify-between gap-4">
                <div className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Node Editor</h1>
                    <p className="text-base-content/80">
                        A simple React Flow canvas for node-based editing.
                    </p>
                    <div className="flex items-center gap-2">
                        <Link to="/" className="btn btn-outline btn-sm">
                            Back to grid
                        </Link>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleAddNode}
                        >
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
                                <div
                                    className="h-full"
                                    onContextMenuCapture={(event) => {
                                        const target = event.target;
                                        if (!(target instanceof HTMLElement)) return;
                                        if (target.closest("[data-project-context-menu]")) return;

                                        const nodeEl = target.closest(
                                            ".react-flow__node",
                                        ) as HTMLElement | null;
                                        const nodeId = nodeEl?.dataset?.id;
                                        if (!nodeId) return;

                                        const node = nodes.find((entry) => entry.id === nodeId);
                                        const ownerId =
                                            typeof (node as any)?.data?.ownerId === "string"
                                                ? (node as any).data.ownerId
                                                : "";
                                        const owner = ownerId ? ownersById.get(ownerId) : undefined;
                                        if (!ownerId || owner?.ownerType !== "project") return;

                                        event.preventDefault();
                                        event.stopPropagation();
                                        setSelectedNodeId(nodeId);
                                        setProjectMenu({
                                            projectId: ownerId,
                                            x: event.clientX,
                                            y: event.clientY,
                                        });
                                    }}
                                >
                                    <ReactFlow
                                        nodes={renderNodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        onConnect={onConnect}
                                        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                                        onPaneClick={() => setSelectedNodeId(null)}
                                        nodeTypes={nodeTypes}
                                        fitView
                                    >
                                        <MiniMap style={miniMapStyle} zoomable pannable />
                                        <Controls />
                                        <Background />
                                    </ReactFlow>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 card bg-base-200 border border-base-300 shadow-md">
                        <div className="card-body space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg">Node owner</h3>
                                    <p className="text-sm text-base-content/70">
                                        Select a node, then assign it to a Project.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={refreshOwners}
                                >
                                    Refresh owners
                                </button>
                            </div>

                            {ownersError && (
                                <div className="alert alert-error">
                                    <span>{ownersError}</span>
                                </div>
                            )}

                            {!selectedNode ? (
                                <div className="text-sm text-base-content/70">
                                    No node selected.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="text-sm">
                                        <span className="font-semibold">Selected node:</span>{" "}
                                        <span className="text-base-content/80">
                                            {selectedNode.id}
                                        </span>
                                    </div>
                                    <label className="form-control w-full max-w-md">
                                        <div className="label">
                                            <span className="label-text">Owner</span>
                                        </div>
                                        <select
                                            className="select select-bordered w-full"
                                            value={selectedOwnerId}
                                            onChange={(event) =>
                                                handleOwnerChange(event.target.value)
                                            }
                                        >
                                            <option value="">No owner</option>
                                            {owners.map((owner) => {
                                                const label = `Project: ${owner.name ?? "Untitled"}`;
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

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold">Projects</div>
                                    <span className="text-xs text-base-content/60">
                                        {projects.length}
                                    </span>
                                </div>
                                {projects.length === 0 ? (
                                    <div className="text-sm text-base-content/70">
                                        No projects yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-44 overflow-y-auto">
                                        {projects.map((project) => (
                                            <div
                                                key={project.id}
                                                className="p-3 border border-base-300 rounded-xl bg-base-100/60"
                                                onContextMenuCapture={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    setProjectMenu({
                                                        projectId: project.id,
                                                        x: event.clientX,
                                                        y: event.clientY,
                                                    });
                                                }}
                                            >
                                                <div className="font-semibold text-sm">
                                                    {project.name?.trim() || "Untitled"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="divider my-0" />

                            <div className="space-y-2">
                                <h4 className="font-semibold">New project</h4>
                                <input
                                    className="input input-bordered w-full"
                                    placeholder="Project name"
                                    value={newProjectName}
                                    onChange={(event) => setNewProjectName(event.target.value)}
                                />
                                <input
                                    className="input input-bordered w-full"
                                    placeholder="Repository URL"
                                    value={newProjectUrl}
                                    onChange={(event) => setNewProjectUrl(event.target.value)}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={fetchRepos}
                                        disabled={reposLoading}
                                    >
                                        {reposLoading ? "Loading repos…" : "Load repos"}
                                    </button>
                                    {newProjectUrl.trim() && (
                                        <a
                                            href={newProjectUrl.trim()}
                                            className="link link-hover text-sm break-all"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {newProjectUrl.trim()}
                                        </a>
                                    )}
                                </div>
                                {reposError && (
                                    <div className="alert alert-error">
                                        <span>{reposError}</span>
                                    </div>
                                )}
                                {!reposLoading && !reposError && repos.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {repos.map((repo) => {
                                            const label = repo.owner?.login
                                                ? `${repo.owner.login}/${repo.name}`
                                                : repo.name;
                                            const isSelected = newProjectUrl.trim() === repo.url;
                                            return (
                                                <div
                                                    key={repo.url}
                                                    className={`p-3 border rounded-xl transition-colors ${
                                                        isSelected
                                                            ? "border-primary bg-primary/10"
                                                            : "border-base-300 bg-base-100/60"
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
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleRepoSelect(repo)}
                                                        >
                                                            {isSelected ? "Selected" : "Select"}
                                                        </button>
                                                    </div>
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
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim() || !newProjectUrl.trim()}
                                >
                                    Create project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {projectMenu && (
                <div
                    data-project-context-menu
                    style={{
                        position: "fixed",
                        left: projectMenu.x,
                        top: projectMenu.y,
                        zIndex: 1000,
                    }}
                    className="card bg-base-100 border border-base-300 shadow-xl min-w-44"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <ul className="menu menu-sm p-2">
                        <li>
                            <button
                                type="button"
                                onClick={() => {
                                    const targetProjectId = projectMenu.projectId;
                                    setProjectMenu(null);
                                    navigate(`/projects/${targetProjectId}`);
                                }}
                            >
                                View details
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

export default NodeEditor;
