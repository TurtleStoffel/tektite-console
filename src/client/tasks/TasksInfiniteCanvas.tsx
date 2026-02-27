import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TaskCreateAtPositionModal } from "./TaskCreateAtPositionModal";
import type { CanvasPoint, ProjectOption, TaskItem, Viewport } from "./types";

type CanvasTask = TaskItem & { canvasPosition: CanvasPoint };

type TasksInfiniteCanvasProps = {
    tasks: TaskItem[];
    projects: ProjectOption[];
    isMarkingDone: boolean;
    isDeleting: boolean;
    isUpdatingProject: boolean;
    isCreatingTask: boolean;
    isCreatingConnection: boolean;
    isDeletingConnection: boolean;
    onMarkDone: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTaskProject: (input: { taskId: string; projectId: string | null }) => void;
    onTaskMoved: (input: { taskId: string; x: number; y: number }) => void;
    onCreateTaskAtPosition: (input: { description: string; x: number; y: number }) => void;
    onConnectionCreate: (input: { taskId: string; connectedTaskId: string }) => void;
    onConnectionDelete: (input: { taskId: string; connectedTaskId: string }) => void;
    onExecuteTask: (taskId: string) => void;
    isExecutingTask: boolean;
    executingTaskId: string | null;
    onTaskClick: (taskId: string) => void;
};

const NODE_WIDTH = 320;
const NODE_HEIGHT = 170;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_SENSITIVITY = 0.0015;
const DEFAULT_VIEWPORT: Viewport = { x: 120, y: 120, scale: 1 };
const INTERACTIVE_SELECTOR = "button, select, input, textarea, a, [role='button']";
const MULTI_SELECT_KEY_HINT = "Shift";

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

function getArrowheadPoints(from: CanvasPoint, to: CanvasPoint): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return `${to.x},${to.y} ${to.x},${to.y} ${to.x},${to.y}`;
    }

    const ux = dx / length;
    const uy = dy / length;
    const arrowLength = 10;
    const arrowWidth = 8;
    const baseX = to.x - ux * arrowLength;
    const baseY = to.y - uy * arrowLength;
    const perpX = -uy;
    const perpY = ux;
    const leftX = baseX + perpX * (arrowWidth / 2);
    const leftY = baseY + perpY * (arrowWidth / 2);
    const rightX = baseX - perpX * (arrowWidth / 2);
    const rightY = baseY - perpY * (arrowWidth / 2);

    return `${to.x},${to.y} ${leftX},${leftY} ${rightX},${rightY}`;
}

export function TasksInfiniteCanvas({
    tasks,
    projects,
    isMarkingDone,
    isDeleting,
    isUpdatingProject,
    isCreatingTask,
    isCreatingConnection,
    isDeletingConnection,
    onMarkDone,
    onDeleteTask,
    onUpdateTaskProject,
    onTaskMoved,
    onCreateTaskAtPosition,
    onConnectionCreate,
    onConnectionDelete,
    onExecuteTask,
    isExecutingTask,
    executingTaskId,
    onTaskClick,
}: TasksInfiniteCanvasProps) {
    const getTaskStateBadge = (task: TaskItem): { className: string; label: string } => {
        if (task.state === "done") {
            return { className: "badge-success", label: "Done" };
        }
        if (task.state === "in_progress") {
            return { className: "badge-warning", label: "In progress" };
        }
        return { className: "badge-neutral", label: "To-do" };
    };
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{
        taskIds: string[];
        anchorTaskId: string;
        startWorldX: number;
        startWorldY: number;
        initialPositions: Record<string, CanvasPoint>;
        moved: boolean;
    } | null>(null);
    const panRef = useRef<{
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const connectionDragRef = useRef<{ fromTaskId: string } | null>(null);
    const selectionBoxRef = useRef<{
        start: CanvasPoint;
        initialSelection: Set<string>;
    } | null>(null);
    const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const [positionOverrides, setPositionOverrides] = useState<Record<string, CanvasPoint>>({});
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{
        start: CanvasPoint;
        end: CanvasPoint;
    } | null>(null);
    const [connectionDragPreview, setConnectionDragPreview] = useState<{
        fromTaskId: string;
        toPoint: CanvasPoint;
    } | null>(null);
    const [createModalTargetPoint, setCreateModalTargetPoint] = useState<CanvasPoint | null>(null);
    const [createModalDescription, setCreateModalDescription] = useState("");

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
    const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

    useEffect(() => {
        setSelectedTaskIds((previous) => previous.filter((taskId) => taskById.has(taskId)));
    }, [taskById]);

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

    const handleCanvasWheel = useCallback((event: WheelEvent) => {
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

    useEffect(() => {
        const surface = canvasRef.current;
        if (!surface) {
            return;
        }

        surface.addEventListener("wheel", handleCanvasWheel, { passive: false });
        return () => {
            surface.removeEventListener("wheel", handleCanvasWheel);
        };
    }, [handleCanvasWheel]);

    const handleCanvasPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0 || event.target !== event.currentTarget) {
                return;
            }

            if (event.shiftKey) {
                const start = screenToWorld(event.clientX, event.clientY);
                selectionBoxRef.current = {
                    start,
                    initialSelection: new Set(selectedTaskIds),
                };
                setSelectionBox({ start, end: start });
                event.currentTarget.setPointerCapture(event.pointerId);
                return;
            }

            panRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originX: viewportRef.current.x,
                originY: viewportRef.current.y,
            };

            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [screenToWorld, selectedTaskIds],
    );

    const handleCanvasContextMenu = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || isCreatingTask) {
                return;
            }

            event.preventDefault();
            const world = screenToWorld(event.clientX, event.clientY);
            const x = Math.round(world.x);
            const y = Math.round(world.y);
            setCreateModalDescription("");
            setCreateModalTargetPoint({ x, y });
            console.info("[tasks-canvas] opened create task modal from context menu", { x, y });
        },
        [isCreatingTask, screenToWorld],
    );

    const handleCreateModalClose = useCallback(() => {
        if (isCreatingTask) {
            return;
        }
        setCreateModalTargetPoint(null);
        setCreateModalDescription("");
    }, [isCreatingTask]);

    const handleCreateModalSubmit = useCallback(() => {
        if (!createModalTargetPoint) {
            throw new Error("Create task modal is missing target point.");
        }

        const description = createModalDescription.trim();
        if (description.length === 0) {
            return;
        }

        console.info("[tasks-canvas] creating task from modal", {
            x: createModalTargetPoint.x,
            y: createModalTargetPoint.y,
        });
        onCreateTaskAtPosition({
            description,
            x: createModalTargetPoint.x,
            y: createModalTargetPoint.y,
        });
        setCreateModalTargetPoint(null);
        setCreateModalDescription("");
    }, [createModalDescription, createModalTargetPoint, onCreateTaskAtPosition]);

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

            if (selectionBoxRef.current) {
                const world = screenToWorld(event.clientX, event.clientY);
                const start = selectionBoxRef.current.start;
                const minX = Math.min(start.x, world.x);
                const maxX = Math.max(start.x, world.x);
                const minY = Math.min(start.y, world.y);
                const maxY = Math.max(start.y, world.y);
                setSelectionBox({ start, end: world });

                const selectedByDrag = new Set<string>();
                for (const task of canvasTasks) {
                    const taskLeft = task.canvasPosition.x;
                    const taskRight = task.canvasPosition.x + NODE_WIDTH;
                    const taskTop = task.canvasPosition.y;
                    const taskBottom = task.canvasPosition.y + NODE_HEIGHT;
                    const intersects =
                        taskLeft <= maxX &&
                        taskRight >= minX &&
                        taskTop <= maxY &&
                        taskBottom >= minY;
                    if (intersects) {
                        selectedByDrag.add(task.id);
                    }
                }
                for (const taskId of selectionBoxRef.current.initialSelection) {
                    selectedByDrag.add(taskId);
                }
                setSelectedTaskIds(Array.from(selectedByDrag));
                return;
            }

            if (!dragRef.current) {
                return;
            }

            dragRef.current.moved = true;
            const world = screenToWorld(event.clientX, event.clientY);
            const dx = world.x - dragRef.current.startWorldX;
            const dy = world.y - dragRef.current.startWorldY;

            setPositionOverrides((previous) => {
                const next = { ...previous };
                for (const taskId of dragRef.current?.taskIds ?? []) {
                    const initialPosition = dragRef.current?.initialPositions[taskId];
                    if (!initialPosition) {
                        continue;
                    }
                    next[taskId] = {
                        x: Math.round(initialPosition.x + dx),
                        y: Math.round(initialPosition.y + dy),
                    };
                }
                return next;
            });
        },
        [canvasTasks, screenToWorld],
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
                if (selectionBoxRef.current) {
                    selectionBoxRef.current = null;
                    setSelectionBox(null);
                }

                if (dragRef.current) {
                    const completedDrag = dragRef.current;
                    dragRef.current = null;
                    if (completedDrag.moved) {
                        for (const taskId of completedDrag.taskIds) {
                            const point = positionOverrides[taskId];
                            if (!point) {
                                continue;
                            }
                            onTaskMoved({
                                taskId,
                                x: point.x,
                                y: point.y,
                            });
                        }
                    } else {
                        onTaskClick(completedDrag.anchorTaskId);
                    }
                }
            } finally {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
            }
        },
        [onConnectionCreate, onTaskClick, onTaskMoved, positionOverrides, taskById],
    );

    const handleTaskPointerDown = useCallback(
        (task: CanvasTask, event: ReactPointerEvent<HTMLElement>) => {
            const interactiveTarget = (event.target as HTMLElement | null)?.closest(
                INTERACTIVE_SELECTOR,
            );
            if (interactiveTarget) {
                return;
            }
            event.stopPropagation();
            if (event.shiftKey) {
                setSelectedTaskIds((previous) =>
                    previous.includes(task.id)
                        ? previous.filter((taskId) => taskId !== task.id)
                        : [...previous, task.id],
                );
                return;
            }

            const world = screenToWorld(event.clientX, event.clientY);
            const dragTaskIds =
                selectedTaskIdSet.has(task.id) && selectedTaskIds.length > 0
                    ? selectedTaskIds
                    : [task.id];
            setSelectedTaskIds(dragTaskIds);
            const initialPositions: Record<string, CanvasPoint> = {};
            for (const taskId of dragTaskIds) {
                const canvasTask = taskById.get(taskId);
                if (!canvasTask) {
                    continue;
                }
                initialPositions[taskId] = canvasTask.canvasPosition;
            }

            dragRef.current = {
                taskIds: dragTaskIds,
                anchorTaskId: task.id,
                startWorldX: world.x,
                startWorldY: world.y,
                initialPositions,
                moved: false,
            };
            const surface = canvasRef.current;
            if (!surface) {
                throw new Error("Canvas surface not mounted.");
            }
            surface.setPointerCapture(event.pointerId);
        },
        [screenToWorld, selectedTaskIdSet, selectedTaskIds, taskById],
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
    for (const task of canvasTasks) {
        for (const connectedTaskId of task.connectionTaskIds) {
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
                        right-click empty canvas space to create a task. Hold{" "}
                        {MULTI_SELECT_KEY_HINT}
                        and drag to multi-select, then drag any selected card to move the group.
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
                    role="application"
                    aria-label="Tasks infinite canvas"
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerCancel={handleCanvasPointerUp}
                    onContextMenu={handleCanvasContextMenu}
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
                                const arrowHeadPoints = getArrowheadPoints(
                                    sourcePoint,
                                    targetPoint,
                                );

                                return (
                                    <g key={connectionKey}>
                                        <line
                                            x1={sourcePoint.x}
                                            y1={sourcePoint.y}
                                            x2={targetPoint.x}
                                            y2={targetPoint.y}
                                            stroke="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                                            strokeWidth={2}
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
                                        <polygon
                                            points={arrowHeadPoints}
                                            fill="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                                            pointerEvents="none"
                                        />
                                    </g>
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
                        {canvasTasks.map((task) => {
                            const stateBadge = getTaskStateBadge(task);
                            const isSelected = selectedTaskIdSet.has(task.id);
                            return (
                                <article
                                    key={task.id}
                                    data-task-id={task.id}
                                    className={`absolute bg-base-200 border rounded-lg shadow-md p-3 select-none ${
                                        isSelected
                                            ? "border-primary ring-2 ring-primary/35"
                                            : "border-base-300"
                                    }`}
                                    style={{
                                        width: NODE_WIDTH,
                                        minHeight: NODE_HEIGHT,
                                        left: task.canvasPosition.x,
                                        top: task.canvasPosition.y,
                                    }}
                                    onPointerDown={(event) => handleTaskPointerDown(task, event)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`badge badge-sm ${stateBadge.className}`}>
                                            {stateBadge.label}
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
                                            disabled={
                                                isMarkingDone || isDeleting || isUpdatingProject
                                            }
                                            onChange={(event) => {
                                                const nextProjectId =
                                                    event.target.value.trim() || null;
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
                                            className="btn btn-xs btn-outline"
                                            disabled={
                                                isExecutingTask || isMarkingDone || isDeleting
                                            }
                                            onClick={() => onExecuteTask(task.id)}
                                        >
                                            {isExecutingTask && executingTaskId === task.id
                                                ? "Executing..."
                                                : "Execute"}
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
                            );
                        })}
                        {selectionBox && (
                            <div
                                className="absolute border border-primary/70 bg-primary/10 pointer-events-none"
                                style={{
                                    left: Math.min(selectionBox.start.x, selectionBox.end.x),
                                    top: Math.min(selectionBox.start.y, selectionBox.end.y),
                                    width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                                    height: Math.abs(selectionBox.end.y - selectionBox.start.y),
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
            <TaskCreateAtPositionModal
                isOpen={createModalTargetPoint !== null}
                description={createModalDescription}
                isCreating={isCreatingTask}
                x={createModalTargetPoint?.x ?? null}
                y={createModalTargetPoint?.y ?? null}
                onDescriptionChange={setCreateModalDescription}
                onClose={handleCreateModalClose}
                onSubmit={handleCreateModalSubmit}
            />
        </div>
    );
}
