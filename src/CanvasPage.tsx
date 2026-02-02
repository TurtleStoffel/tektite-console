import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentNode from "./DocumentNode";
import ProjectNode from "./ProjectNode";
import RepositoryNode from "./RepositoryNode";

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.8;
const ZOOM_SENSITIVITY = 0.0015;
const DEFAULT_NODE_SIZE = { width: 180, height: 110 };

type CanvasNode = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    kind: "project" | "repository" | "document" | "rectangle";
};

type CanvasEdge = {
    id: string;
    from: string;
    to: string;
};

type ProjectSummary = {
    id: string;
    name: string | null;
    url: string | null;
};

type Viewport = {
    x: number;
    y: number;
    scale: number;
};

type ConnectMode = {
    active: boolean;
    sourceId: string | null;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function CanvasPage({ drawerToggleId }: { drawerToggleId: string }) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
    const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const [nodes, setNodes] = useState<CanvasNode[]>([]);
    const [edges, setEdges] = useState<CanvasEdge[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [connectMode, setConnectMode] = useState<ConnectMode>({ active: false, sourceId: null });
    const [viewport, setViewport] = useState<Viewport>({ x: 120, y: 120, scale: 1 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        clientX: number;
        clientY: number;
        worldX: number;
        worldY: number;
    } | null>(null);
    const [hasSeededProjects, setHasSeededProjects] = useState(false);

    const { data: projects = [] } = useQuery<ProjectSummary[]>({
        queryKey: ["projects"],
        queryFn: () =>
            fetch("/api/projects")
                .then((res) => res.json())
                .then((payload) => (Array.isArray(payload?.data) ? payload.data : [])),
    });

    useEffect(() => {
        viewRef.current = viewport;
    }, [viewport]);

    const screenToWorld = useCallback((clientX: number, clientY: number) => {
        const surface = canvasRef.current;
        if (!surface) {
            throw new Error("Canvas surface not mounted.");
        }
        const rect = surface.getBoundingClientRect();
        const x = (clientX - rect.left - viewRef.current.x) / viewRef.current.scale;
        const y = (clientY - rect.top - viewRef.current.y) / viewRef.current.scale;
        return { x, y };
    }, []);

    const createNode = useCallback(
        (position?: { x: number; y: number }) => {
            const surface = canvasRef.current;
            if (!surface) {
                throw new Error("Canvas surface not mounted.");
            }
            const rect = surface.getBoundingClientRect();
            const center = position ?? screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
            const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            setNodes((prev) => {
                const nextNode: CanvasNode = {
                    id,
                    x: center.x - DEFAULT_NODE_SIZE.width / 2,
                    y: center.y - DEFAULT_NODE_SIZE.height / 2,
                    width: DEFAULT_NODE_SIZE.width,
                    height: DEFAULT_NODE_SIZE.height,
                    label: `Rect ${prev.length + 1}`,
                    kind: "rectangle",
                };
                return [...prev, nextNode];
            });
            setSelectedId(id);
            console.info(`[canvas] created rectangle ${id}.`);
        },
        [screenToWorld],
    );

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        setNodes((prev) => prev.filter((node) => node.id !== selectedId));
        setEdges((prev) => prev.filter((edge) => edge.from !== selectedId && edge.to !== selectedId));
        console.info(`[canvas] deleted rectangle ${selectedId}.`);
        setSelectedId(null);
    }, [selectedId]);

    useEffect(() => {
        if (hasSeededProjects) return;
        if (projects.length === 0) return;
        const spacingX = 240;
        const spacingY = 160;
        const columns = Math.max(1, Math.ceil(Math.sqrt(projects.length)));
        const originX = 120;
        const originY = 120;
        setNodes(
            projects.map((project, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                return {
                    id: project.id,
                    x: originX + col * spacingX,
                    y: originY + row * spacingY,
                    width: DEFAULT_NODE_SIZE.width,
                    height: DEFAULT_NODE_SIZE.height,
                    label: project.name?.trim() || "Untitled project",
                    kind: "project",
                };
            }),
        );
        setEdges([]);
        setHasSeededProjects(true);
        console.info("[canvas] seeded rectangles from persisted projects.");
    }, [hasSeededProjects, projects]);

    const toggleConnectMode = useCallback(() => {
        setConnectMode((prev) => ({
            active: !prev.active,
            sourceId: null,
        }));
    }, []);

    const resetView = useCallback(() => {
        setViewport({ x: 120, y: 120, scale: 1 });
        console.info("[canvas] reset viewport.");
    }, []);

    const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const surface = canvasRef.current;
        if (!surface) {
            throw new Error("Canvas surface not mounted.");
        }
        const rect = surface.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const current = viewRef.current;
        const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        const nextScale = clamp(current.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        const worldX = (pointerX - current.x) / current.scale;
        const worldY = (pointerY - current.y) / current.scale;
        const nextX = pointerX - worldX * nextScale;
        const nextY = pointerY - worldY * nextScale;
        setViewport({ x: nextX, y: nextY, scale: nextScale });
    }, []);

    const handleContextMenu = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            const position = screenToWorld(event.clientX, event.clientY);
            setContextMenu({
                isOpen: true,
                clientX: event.clientX,
                clientY: event.clientY,
                worldX: position.x,
                worldY: position.y,
            });
        },
        [screenToWorld],
    );

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleBackgroundPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || dragNodeRef.current) return;
        if (!isSpacePressed && event.target !== event.currentTarget) return;
        panRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: viewRef.current.x,
            originY: viewRef.current.y,
        };
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    }, [isSpacePressed]);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (panRef.current) {
            const dx = event.clientX - panRef.current.startX;
            const dy = event.clientY - panRef.current.startY;
            setViewport((prev) => ({
                ...prev,
                x: panRef.current ? panRef.current.originX + dx : prev.x,
                y: panRef.current ? panRef.current.originY + dy : prev.y,
            }));
            return;
        }

        if (dragNodeRef.current) {
            const world = screenToWorld(event.clientX, event.clientY);
            const offsetX = dragNodeRef.current.offsetX;
            const offsetY = dragNodeRef.current.offsetY;
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === dragNodeRef.current?.id
                        ? { ...node, x: world.x - offsetX, y: world.y - offsetY }
                        : node,
                ),
            );
        }
    }, [screenToWorld]);

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (panRef.current) {
            panRef.current = null;
        }
        if (dragNodeRef.current) {
            dragNodeRef.current = null;
        }
        if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
            (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        }
    }, []);

    const handleNodePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
            event.stopPropagation();
            setSelectedId(node.id);

            if (connectMode.active) {
                setConnectMode((prev) => {
                    if (!prev.sourceId) {
                        return { ...prev, sourceId: node.id };
                    }

                    if (prev.sourceId === node.id) {
                        return { ...prev, sourceId: null };
                    }

                    setEdges((edgesPrev) => {
                        const sourceId = prev.sourceId;
                        if (!sourceId) return edgesPrev;
                        const existing = edgesPrev.some(
                            (edge) =>
                                (edge.from === sourceId && edge.to === node.id) ||
                                (edge.from === node.id && edge.to === sourceId),
                        );
                        if (existing) {
                            return edgesPrev;
                        }
                        const edgeId =
                            globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                        console.info(`[canvas] connected ${sourceId} to ${node.id}.`);
                        return [...edgesPrev, { id: edgeId, from: sourceId, to: node.id }];
                    });

                    return { ...prev, sourceId: node.id };
                });
                return;
            }

            if (event.button !== 0) return;
            const world = screenToWorld(event.clientX, event.clientY);
            dragNodeRef.current = {
                id: node.id,
                offsetX: world.x - node.x,
                offsetY: world.y - node.y,
            };
            canvasRef.current?.setPointerCapture(event.pointerId);
        },
        [connectMode.active, screenToWorld],
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === "Space") {
                event.preventDefault();
                setIsSpacePressed(true);
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                deleteSelected();
            }

            if (event.key === "Escape") {
                setConnectMode({ active: false, sourceId: null });
                setContextMenu(null);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === "Space") {
                event.preventDefault();
                setIsSpacePressed(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [deleteSelected]);

    const gridStyle = useMemo(() => {
        const gridSize = 80 * viewport.scale;
        return {
            backgroundImage:
                "linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)",
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        } as React.CSSProperties;
    }, [viewport.scale, viewport.x, viewport.y]);

    const edgeLines = useMemo(() => {
        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        return edges.reduce<{ id: string; x1: number; y1: number; x2: number; y2: number }[]>(
            (acc, edge) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return acc;
                acc.push({
                    id: edge.id,
                    x1: from.x + from.width / 2,
                    y1: from.y + from.height / 2,
                    x2: to.x + to.width / 2,
                    y2: to.y + to.height / 2,
                });
                return acc;
            },
            [],
        );
    }, [edges, nodes]);

    return (
        <div className="w-full min-h-screen p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <header className="space-y-1">
                    <h1 className="text-4xl font-bold">Canvas</h1>
                    <p className="text-sm text-base-content/70">
                        Pan, zoom, and connect shapes to map your ideas.
                    </p>
                </header>
                <div className="flex items-center gap-2">
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className={`btn btn-sm ${connectMode.active ? "btn-secondary" : "btn-ghost"}`}
                    onClick={toggleConnectMode}
                >
                    {connectMode.active ? "Connecting…" : "Connect"}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={deleteSelected}
                    disabled={!selectedId}
                >
                    Delete selected
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetView}>
                    Reset view
                </button>
                <div className="badge badge-ghost badge-sm">
                    Zoom {(viewport.scale * 100).toFixed(0)}%
                </div>
            </div>

            <div
                ref={canvasRef}
                className={`relative flex-1 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-inner ${
                    isSpacePressed ? "cursor-grab" : "cursor-default"
                }`}
                style={{ touchAction: "none" }}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
                onPointerDown={(event) => {
                    if (contextMenu?.isOpen && event.target === event.currentTarget) {
                        closeContextMenu();
                    }
                    handleBackgroundPointerDown(event);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="absolute inset-0" style={gridStyle} />

                <div
                    className="absolute left-0 top-0 origin-top-left"
                    style={{
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                    }}
                >
                    <svg className="absolute left-0 top-0 h-full w-full overflow-visible">
                        {edgeLines.map((edge) => (
                            <line
                                key={edge.id}
                                x1={edge.x1}
                                y1={edge.y1}
                                x2={edge.x2}
                                y2={edge.y2}
                                stroke="rgba(14, 116, 144, 0.6)"
                                strokeWidth={2}
                            />
                        ))}
                    </svg>

                    {nodes.map((node) => {
                        const isSelected = node.id === selectedId;
                        const isConnectSource = connectMode.sourceId === node.id;
                        if (node.kind === "repository") {
                            return (
                                <RepositoryNode
                                    key={node.id}
                                    id={node.id}
                                    label={node.label}
                                    width={node.width}
                                    height={node.height}
                                    x={node.x}
                                    y={node.y}
                                    isSelected={isSelected}
                                    isConnectSource={isConnectSource}
                                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                                />
                            );
                        }

                        if (node.kind === "document") {
                            return (
                                <DocumentNode
                                    key={node.id}
                                    id={node.id}
                                    label={node.label}
                                    width={node.width}
                                    height={node.height}
                                    x={node.x}
                                    y={node.y}
                                    isSelected={isSelected}
                                    isConnectSource={isConnectSource}
                                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                                />
                            );
                        }

                        return (
                            <ProjectNode
                                key={node.id}
                                id={node.id}
                                label={node.label}
                                width={node.width}
                                height={node.height}
                                x={node.x}
                                y={node.y}
                                isSelected={isSelected}
                                isConnectSource={isConnectSource}
                                onPointerDown={(event) => handleNodePointerDown(event, node)}
                            />
                        );
                    })}
                </div>

                <div className="absolute bottom-4 left-4 space-y-1 text-xs text-base-content/60">
                    <div>Right-click for menu · Wheel to zoom · Drag to pan (hold Space)</div>
                    <div>Connect mode: click two rectangles · Drag rectangles to move · Delete key removes</div>
                </div>

                {contextMenu?.isOpen && (
                    <div
                        className="absolute z-30"
                        style={{
                            left: contextMenu.clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0),
                            top: contextMenu.clientY - (canvasRef.current?.getBoundingClientRect().top ?? 0),
                        }}
                        onPointerDown={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        <div className="menu rounded-box border border-base-300 bg-base-100 shadow-lg w-52">
                            <button
                                type="button"
                                className="btn btn-ghost justify-start"
                                onClick={() => {
                                    createNode({ x: contextMenu.worldX, y: contextMenu.worldY });
                                    closeContextMenu();
                                }}
                            >
                                Add rectangle
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CanvasPage;
