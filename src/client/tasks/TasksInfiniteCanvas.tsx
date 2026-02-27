import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasPoint, ProjectOption, TaskItem, Viewport } from "./types";

type CanvasTask = TaskItem & { canvasPosition: CanvasPoint };

type TasksInfiniteCanvasProps = {
    tasks: TaskItem[];
    projects: ProjectOption[];
    isMarkingDone: boolean;
    isDeleting: boolean;
    isUpdatingProject: boolean;
    isCreatingConnection: boolean;
    isDeletingConnection: boolean;
    onMarkDone: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTaskProject: (input: { taskId: string; projectId: string | null }) => void;
    onTaskMoved: (input: { taskId: string; x: number; y: number }) => void;
    onConnectionCreate: (input: { taskId: string; connectedTaskId: string }) => void;
    onConnectionDelete: (input: { taskId: string; connectedTaskId: string }) => void;
};

const NODE_WIDTH = 320;
const NODE_HEIGHT = 170;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_SENSITIVITY = 0.0015;
const DEFAULT_VIEWPORT: Viewport = { x: 120, y: 120, scale: 1 };

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getDefaultNodePosition(index: number): CanvasPoint {
    const columns = 5;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
        x: 120 + column * (320 + 24),
        y: 120 + row * (170 + 24),
    };
}

function projectToNodeEdge(from: CanvasPoint, to: CanvasPoint): CanvasPoint {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) {
        return from;
    }

    const halfWidth = NODE_WIDTH / 2;
    const halfHeight = NODE_HEIGHT / 2;
    const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
    return {
        x: from.x + dx * scale,
        y: from.y + dy * scale,
    };
}

export function TasksInfiniteCanvas({
    tasks,
    projects,
    isMarkingDone,
    isDeleting,
    isUpdatingProject,
    isCreatingConnection,
    isDeletingConnection,
    onMarkDone,
    onDeleteTask,
    onUpdateTaskProject,
    onTaskMoved,
    onConnectionCreate,
    onConnectionDelete,
}: TasksInfiniteCanvasProps) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{
        taskId: string;
        offsetX: number;
        offsetY: number;
        moved: boolean;
    } | null>(null);
    const panRef = useRef<{
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const connectionDragRef = useRef<{ fromTaskId: string } | null>(null);
    const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const [positionOverrides, setPositionOverrides] = useState<Record<string, CanvasPoint>>({});
    const [connectionDragPreview, setConnectionDragPreview] = useState<{
        fromTaskId: string;
        toPoint: CanvasPoint;
    } | null>(null);

    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);

    useEffect(() => {
        setPositionOverrides((previous) => {
            const next: Record<string, CanvasPoint> = {};
            for (const [index, task] of tasks.entries()) {
                const previousPosition = previous[task.id];
                if (previousPosition) {
                    next[task.id] = previousPosition;
                    continue;
                }
                if (task.canvasPosition) {
                    next[task.id] = task.canvasPosition;
                    continue;
                }
                next[task.id] = getDefaultNodePosition(index);
            }
            return next;
        });
    }, [tasks]);

    const canvasTasks = useMemo(
        () =>
            tasks.map((task, index) => ({
                ...task,
                canvasPosition:
                    positionOverrides[task.id] ??
                    task.canvasPosition ??
                    getDefaultNodePosition(index),
            })),
        [positionOverrides, tasks],
    );

    const taskById = useMemo(
        () => new Map(canvasTasks.map((task) => [task.id, task])),
        [canvasTasks],
    );

    const screenToWorld = useCallback((clientX: number, clientY: number) => {
        const surface = canvasRef.current;
        if (!surface) {
            throw new Error("Canvas surface not mounted.");
        }
        const rect = surface.getBoundingClientRect();
        const x = (clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale;
        const y = (clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale;
        return { x, y };
    }, []);

    const handleCanvasWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const surface = canvasRef.current;
        if (!surface) {
            throw new Error("Canvas surface not mounted.");
        }
        const rect = surface.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const current = viewportRef.current;
        const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        const nextScale = clamp(current.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        const worldX = (pointerX - current.x) / current.scale;
        const worldY = (pointerY - current.y) / current.scale;
        const nextX = pointerX - worldX * nextScale;
        const nextY = pointerY - worldY * nextScale;
        setViewport({ x: nextX, y: nextY, scale: nextScale });
    }, []);

    const handleCanvasPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.target !== event.currentTarget) {
            return;
        }

        panRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: viewportRef.current.x,
            originY: viewportRef.current.y,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
    }, []);

    const handleCanvasPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (connectionDragRef.current) {
                const world = screenToWorld(event.clientX, event.clientY);
                setConnectionDragPreview({
                    fromTaskId: connectionDragRef.current.fromTaskId,
                    toPoint: world,
                });
                return;
            }

            if (panRef.current) {
                const dx = event.clientX - panRef.current.startX;
                const dy = event.clientY - panRef.current.startY;
                setViewport((previous) => ({
                    ...previous,
                    x: panRef.current ? panRef.current.originX + dx : previous.x,
                    y: panRef.current ? panRef.current.originY + dy : previous.y,
                }));
                return;
            }

            if (!dragRef.current) {
                return;
            }

            dragRef.current.moved = true;
            const world = screenToWorld(event.clientX, event.clientY);
            const nextPoint = {
                x: Math.round(world.x - dragRef.current.offsetX),
                y: Math.round(world.y - dragRef.current.offsetY),
            };

            setPositionOverrides((previous) => ({
                ...previous,
                [dragRef.current?.taskId ?? ""]: nextPoint,
            }));
        },
        [screenToWorld],
    );

    const handleCanvasPointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            try {
                if (connectionDragRef.current) {
                    const fromTaskId = connectionDragRef.current.fromTaskId;
                    connectionDragRef.current = null;
                    setConnectionDragPreview(null);

                    const targetElement = document
                        .elementFromPoint(event.clientX, event.clientY)
                        ?.closest<HTMLElement>("[data-task-id]");
                    const connectedTaskId = targetElement?.dataset.taskId;
                    if (!connectedTaskId || connectedTaskId === fromTaskId) {
                        return;
                    }

                    const sourceTask = taskById.get(fromTaskId);
                    if (!sourceTask) {
                        throw new Error("Source task was not found while creating a connection.");
                    }
                    if (sourceTask.connectionTaskIds.includes(connectedTaskId)) {
                        return;
                    }

                    onConnectionCreate({ taskId: fromTaskId, connectedTaskId });
                    return;
                }

                if (panRef.current) {
                    panRef.current = null;
                }

                if (dragRef.current) {
                    const completedDrag = dragRef.current;
                    dragRef.current = null;
                    if (completedDrag.moved) {
                        const point = positionOverrides[completedDrag.taskId];
                        if (point) {
                            onTaskMoved({
                                taskId: completedDrag.taskId,
                                x: point.x,
                                y: point.y,
                            });
                        }
                    }
                }
            } finally {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
            }
        },
        [onConnectionCreate, onTaskMoved, positionOverrides, taskById],
    );

    const handleTaskPointerDown = useCallback(
        (task: CanvasTask, event: ReactPointerEvent<HTMLElement>) => {
            event.stopPropagation();
            const world = screenToWorld(event.clientX, event.clientY);
            dragRef.current = {
                taskId: task.id,
                offsetX: world.x - task.canvasPosition.x,
                offsetY: world.y - task.canvasPosition.y,
                moved: false,
            };
            const surface = canvasRef.current;
            if (!surface) {
                throw new Error("Canvas surface not mounted.");
            }
            surface.setPointerCapture(event.pointerId);
        },
        [screenToWorld],
    );

    const handleConnectionPointerDown = useCallback(
        (task: CanvasTask, event: ReactPointerEvent<HTMLElement>) => {
            event.stopPropagation();
            const surface = canvasRef.current;
            if (!surface) {
                throw new Error("Canvas surface not mounted.");
            }

            connectionDragRef.current = { fromTaskId: task.id };
            setConnectionDragPreview({
                fromTaskId: task.id,
                toPoint: screenToWorld(event.clientX, event.clientY),
            });
            surface.setPointerCapture(event.pointerId);
        },
        [screenToWorld],
    );

    const canvasConnections: Array<{ fromTaskId: string; toTaskId: string }> = [];
    const seenConnectionPairs = new Set<string>();
    for (const task of canvasTasks) {
        for (const connectedTaskId of task.connectionTaskIds) {
            const pairKey =
                task.id < connectedTaskId
                    ? `${task.id}:${connectedTaskId}`
                    : `${connectedTaskId}:${task.id}`;
            if (seenConnectionPairs.has(pairKey)) {
                continue;
            }
            seenConnectionPairs.add(pairKey);
            canvasConnections.push({ fromTaskId: task.id, toTaskId: connectedTaskId });
        }
    }

    const handleConnectionLineClick = useCallback(
        (
            connection: { fromTaskId: string; toTaskId: string },
            event: ReactPointerEvent<SVGLineElement>,
        ) => {
            event.stopPropagation();
            if (!event.altKey) {
                return;
            }
            if (
                isMarkingDone ||
                isDeleting ||
                isUpdatingProject ||
                isCreatingConnection ||
                isDeletingConnection
            ) {
                return;
            }
            if (!window.confirm("Delete this task connection?")) {
                return;
            }
            onConnectionDelete({
                taskId: connection.fromTaskId,
                connectedTaskId: connection.toTaskId,
            });
        },
        [
            isCreatingConnection,
            isDeleting,
            isDeletingConnection,
            isMarkingDone,
            isUpdatingProject,
            onConnectionDelete,
        ],
    );

    return (
        <div className="card bg-base-200 border border-base-300 shadow-md h-full">
            <div className="card-body p-3 flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between px-1 pb-2">
                    <p className="text-xs text-base-content/70">
                        Drag tasks to arrange, drag empty space to pan, use the wheel to zoom, and
                        Alt+click a connection line to delete it.
                    </p>
                    <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setViewport(DEFAULT_VIEWPORT)}
                    >
                        Reset view
                    </button>
                </div>
                <div
                    ref={canvasRef}
                    className="relative h-full min-h-0 overflow-hidden rounded-xl border border-base-300 bg-base-100"
                    onWheel={handleCanvasWheel}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerCancel={handleCanvasPointerUp}
                >
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage:
                                "linear-gradient(to right, color-mix(in oklab, var(--color-base-content) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-base-content) 12%, transparent) 1px, transparent 1px)",
                            backgroundSize: "40px 40px",
                            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                        }}
                    />
                    <div
                        className="absolute top-0 left-0"
                        style={{
                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                            transformOrigin: "0 0",
                            width: 1,
                            height: 1,
                        }}
                    >
                        <svg
                            className="absolute overflow-visible"
                            style={{ top: 0, left: 0 }}
                            role="img"
                            aria-label="Task connection graph"
                        >
                            <defs>
                                <marker
                                    id="task-connection-arrow"
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="6"
                                    refY="4"
                                    orient="auto"
                                    markerUnits="strokeWidth"
                                >
                                    <path
                                        d="M0,0 L8,4 L0,8 z"
                                        fill="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                                    />
                                </marker>
                            </defs>
                            {canvasConnections.map(({ fromTaskId, toTaskId }) => {
                                const connectionKey = `${fromTaskId}:${toTaskId}`;
                                const sourceTask = taskById.get(fromTaskId);
                                const targetTask = taskById.get(toTaskId);
                                if (!sourceTask || !targetTask) {
                                    return null;
                                }

                                const x1 = sourceTask.canvasPosition.x + NODE_WIDTH / 2;
                                const y1 = sourceTask.canvasPosition.y + NODE_HEIGHT / 2;
                                const x2 = targetTask.canvasPosition.x + NODE_WIDTH / 2;
                                const y2 = targetTask.canvasPosition.y + NODE_HEIGHT / 2;
                                const sourcePoint = projectToNodeEdge(
                                    { x: x1, y: y1 },
                                    { x: x2, y: y2 },
                                );
                                const targetPoint = projectToNodeEdge(
                                    { x: x2, y: y2 },
                                    { x: x1, y: y1 },
                                );

                                return (
                                    <line
                                        key={connectionKey}
                                        x1={sourcePoint.x}
                                        y1={sourcePoint.y}
                                        x2={targetPoint.x}
                                        y2={targetPoint.y}
                                        stroke="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                                        strokeWidth={2}
                                        markerEnd="url(#task-connection-arrow)"
                                        className="cursor-pointer"
                                        pointerEvents="stroke"
                                        aria-label={`Connection from ${sourceTask.description} to ${targetTask.description}`}
                                        onPointerDown={(event) =>
                                            handleConnectionLineClick(
                                                { fromTaskId, toTaskId },
                                                event,
                                            )
                                        }
                                    />
                                );
                            })}
                            {connectionDragPreview &&
                                taskById.get(connectionDragPreview.fromTaskId) && (
                                    <line
                                        x1={
                                            (taskById.get(connectionDragPreview.fromTaskId)
                                                ?.canvasPosition.x ?? 0) +
                                            NODE_WIDTH / 2
                                        }
                                        y1={
                                            (taskById.get(connectionDragPreview.fromTaskId)
                                                ?.canvasPosition.y ?? 0) +
                                            NODE_HEIGHT / 2
                                        }
                                        x2={connectionDragPreview.toPoint.x}
                                        y2={connectionDragPreview.toPoint.y}
                                        stroke="var(--color-primary)"
                                        strokeWidth={2}
                                        strokeDasharray="6 5"
                                    />
                                )}
                        </svg>
                        {canvasTasks.map((task) => (
                            <article
                                key={task.id}
                                data-task-id={task.id}
                                className="absolute bg-base-200 border border-base-300 rounded-lg shadow-md p-3 select-none"
                                style={{
                                    width: NODE_WIDTH,
                                    minHeight: NODE_HEIGHT,
                                    left: task.canvasPosition.x,
                                    top: task.canvasPosition.y,
                                }}
                                onPointerDown={(event) => handleTaskPointerDown(task, event)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`badge badge-sm ${task.isDone ? "badge-success" : "badge-warning"}`}
                                    >
                                        {task.isDone ? "Done" : "In progress"}
                                    </span>
                                    <span className="text-[11px] text-base-content/50">
                                        {task.id.slice(0, 8)}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm leading-5">{task.description}</p>
                                <div className="mt-3">
                                    <select
                                        className="select select-bordered select-xs w-full"
                                        value={task.projectId ?? ""}
                                        disabled={isMarkingDone || isDeleting || isUpdatingProject}
                                        onChange={(event) => {
                                            const nextProjectId = event.target.value.trim() || null;
                                            onUpdateTaskProject({
                                                taskId: task.id,
                                                projectId: nextProjectId,
                                            });
                                        }}
                                    >
                                        <option value="">Unassigned</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>
                                                {project.name?.trim() || project.id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline"
                                        disabled={
                                            isMarkingDone ||
                                            isDeleting ||
                                            isUpdatingProject ||
                                            isCreatingConnection
                                        }
                                        onPointerDown={(event) =>
                                            handleConnectionPointerDown(task, event)
                                        }
                                    >
                                        Connect
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-success"
                                        disabled={task.isDone || isMarkingDone || isDeleting}
                                        onClick={() => onMarkDone(task.id)}
                                    >
                                        Done
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-error btn-outline"
                                        disabled={isMarkingDone || isDeleting}
                                        onClick={() => {
                                            if (!window.confirm("Delete this task?")) return;
                                            onDeleteTask(task.id);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
