import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TasksInfiniteCanvas } from "./tasks/TasksInfiniteCanvas";
import { TasksListView } from "./tasks/TasksListView";
import type { CanvasPoint, ProjectOption, TaskItem, Viewport } from "./tasks/types";
import { getErrorMessage } from "./utils/errors";

type TasksPageProps = {
    drawerToggleId: string;
};

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_SENSITIVITY = 0.0015;
const SORT_ORDER_GAP = 1024;

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

function getSortOrderForMove(options: {
    list: { sortOrder: number }[];
    currentIndex: number;
    targetIndex: number;
}) {
    const listWithoutCurrent = options.list.filter((_, index) => index !== options.currentIndex);
    const insertIndex =
        options.targetIndex > options.currentIndex ? options.targetIndex - 1 : options.targetIndex;
    const before = listWithoutCurrent[insertIndex - 1] ?? null;
    const after = listWithoutCurrent[insertIndex] ?? null;

    if (before && after) {
        return Math.floor((before.sortOrder + after.sortOrder) / 2);
    }
    if (!before && after) {
        return after.sortOrder - SORT_ORDER_GAP;
    }
    if (before && !after) {
        return before.sortOrder + SORT_ORDER_GAP;
    }

    return options.list[options.currentIndex]?.sortOrder ?? 0;
}

export function TasksPage({ drawerToggleId }: TasksPageProps) {
    const queryClient = useQueryClient();
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
    const viewportRef = useRef<Viewport>({ x: 120, y: 120, scale: 1 });

    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
    const [projectFilter, setProjectFilter] = useState<"all" | "assigned" | "unassigned">("all");
    const [viewMode, setViewMode] = useState<"list" | "canvas">("list");
    const [viewport, setViewport] = useState<Viewport>({ x: 120, y: 120, scale: 1 });
    const [positionOverrides, setPositionOverrides] = useState<Record<string, CanvasPoint>>({});
    const [connectionDragPreview, setConnectionDragPreview] = useState<{
        fromTaskId: string;
        toPoint: CanvasPoint;
    } | null>(null);

    const {
        data: tasks = [],
        isLoading,
        isFetching,
        error: tasksErrorRaw,
        refetch,
    } = useQuery<TaskItem[]>({
        queryKey: ["tasks", { statusFilter, projectFilter }],
        queryFn: async () => {
            console.info("[tasks] loading all tasks...");
            const searchParams = new URLSearchParams();
            if (statusFilter === "open") {
                searchParams.set("isDone", "false");
            }
            if (statusFilter === "done") {
                searchParams.set("isDone", "true");
            }
            if (projectFilter !== "all") {
                searchParams.set("project", projectFilter);
            }

            const query = searchParams.toString();
            const res = await fetch(query.length > 0 ? `/api/tasks?${query}` : "/api/tasks");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load tasks.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as TaskItem[]) : [];
            console.info(`[tasks] loaded ${list.length} tasks.`);
            return list;
        },
    });

    const { data: projects = [] } = useQuery<ProjectOption[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            console.info("[tasks] loading projects for assignment...");
            const res = await fetch("/api/projects");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load projects.");
            }
            const list = Array.isArray(payload?.data) ? (payload.data as ProjectOption[]) : [];
            console.info(`[tasks] loaded ${list.length} projects for assignment.`);
            return list;
        },
    });

    const { mutate: markDone, isPending: isMarkingDone } = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to mark task as done.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task marked done");
        },
    });

    const { mutate: deleteTask, isPending: isDeleting } = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to delete task.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task deleted");
        },
    });

    const { mutate: updateTaskProject, isPending: isUpdatingProject } = useMutation({
        mutationFn: async (input: { taskId: string; projectId: string | null }) => {
            const res = await fetch(`/api/tasks/${input.taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: input.projectId,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to update task project.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task project updated");
        },
    });

    const { mutate: saveTaskCanvasPosition } = useMutation({
        mutationFn: async (input: { taskId: string; x: number; y: number }) => {
            const res = await fetch(`/api/tasks/${input.taskId}/canvas-position`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x: input.x, y: input.y }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to save task position.");
            }
        },
        onError: (error) => {
            console.error("[tasks] failed to save canvas position", error);
        },
        onSuccess: (_data, input) => {
            console.info("[tasks] saved task canvas position", {
                taskId: input.taskId,
                x: input.x,
                y: input.y,
            });
        },
    });

    const { mutate: createTaskConnection, isPending: isCreatingConnection } = useMutation({
        mutationFn: async (input: { taskId: string; connectedTaskId: string }) => {
            const res = await fetch("/api/tasks/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create task connection.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task connection created");
        },
    });

    const { mutate: deleteTaskConnection, isPending: isDeletingConnection } = useMutation({
        mutationFn: async (input: { taskId: string; connectedTaskId: string }) => {
            const res = await fetch("/api/tasks/connections", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to delete task connection.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            console.info("[tasks] task connection deleted");
        },
    });

    const reorderTasksMutation = useMutation({
        mutationFn: async (input: { taskId: string; sortOrder: number }) => {
            const res = await fetch("/api/tasks/order", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to reorder tasks.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
            await queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
            console.info("[tasks] reordered");
        },
    });

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

    const tasksError = getErrorMessage(tasksErrorRaw);

    const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

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

    const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
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

    const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.target !== event.currentTarget) {
            return;
        }

        panRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: viewportRef.current.x,
            originY: viewportRef.current.y,
        };

        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    }, []);

    const handleCanvasPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
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
        (event: React.PointerEvent<HTMLDivElement>) => {
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

                    const sourceTask = tasksById.get(fromTaskId);
                    if (!sourceTask) {
                        throw new Error("Source task was not found while creating a connection.");
                    }
                    if (sourceTask.connectionTaskIds.includes(connectedTaskId)) {
                        return;
                    }

                    createTaskConnection({ taskId: fromTaskId, connectedTaskId });
                    return;
                }

                if (panRef.current) {
                    panRef.current = null;
                }

                if (dragRef.current) {
                    const completedDrag = dragRef.current;
                    dragRef.current = null;
                    if (completedDrag.moved) {
                        const task = tasksById.get(completedDrag.taskId);
                        const point = positionOverrides[completedDrag.taskId];
                        if (task && point) {
                            saveTaskCanvasPosition({
                                taskId: task.id,
                                x: point.x,
                                y: point.y,
                            });
                        }
                    }
                }
            } finally {
                if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
                    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
                }
            }
        },
        [createTaskConnection, positionOverrides, saveTaskCanvasPosition, tasksById],
    );

    const handleTaskPointerDown = useCallback(
        (
            task: TaskItem & { canvasPosition: CanvasPoint },
            event: React.PointerEvent<HTMLElement>,
        ) => {
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
        (
            task: TaskItem & { canvasPosition: CanvasPoint },
            event: React.PointerEvent<HTMLElement>,
        ) => {
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

    const isCanvasView = viewMode === "canvas";
    const canReorderTasks = statusFilter === "all" && projectFilter === "all";
    const reorderTasksError = getErrorMessage(reorderTasksMutation.error);

    const handleMoveTask = useCallback(
        (taskId: string, direction: "up" | "down") => {
            if (!canReorderTasks) {
                throw new Error("Task reordering is only supported in the unfiltered list view.");
            }

            const currentIndex = tasks.findIndex((task) => task.id === taskId);
            if (currentIndex < 0) {
                throw new Error("Task to reorder was not found in list.");
            }

            const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= tasks.length) {
                return;
            }

            const sortOrder = getSortOrderForMove({
                list: tasks,
                currentIndex,
                targetIndex,
            });
            reorderTasksMutation.mutate({ taskId, sortOrder });
        },
        [canReorderTasks, reorderTasksMutation, tasks],
    );

    return (
        <div
            className={`relative z-10 w-full p-6 ${
                isCanvasView
                    ? "flex h-[calc(100vh-73px)] flex-col gap-4"
                    : "mx-auto max-w-6xl space-y-6"
            }`}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Tasks</h1>
                    <p className="text-sm text-base-content/70">
                        Tasks in this workspace, including pending and completed runs.
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
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {tasksError && (
                <div className="alert alert-error text-sm">
                    <span>{tasksError}</span>
                </div>
            )}
            {reorderTasksError && (
                <div className="alert alert-error text-sm">
                    <span>{reorderTasksError}</span>
                </div>
            )}

            <div className="card bg-base-200 border border-base-300 shadow-md">
                <div className="card-body p-4 flex flex-col md:flex-row md:items-end gap-3">
                    <label className="form-control w-full md:max-w-xs">
                        <span className="label-text text-sm font-medium">Status</span>
                        <select
                            className="select select-bordered"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value as typeof statusFilter)
                            }
                        >
                            <option value="all">All</option>
                            <option value="open">In progress only</option>
                            <option value="done">Done only</option>
                        </select>
                    </label>

                    <label className="form-control w-full md:max-w-xs">
                        <span className="label-text text-sm font-medium">Project</span>
                        <select
                            className="select select-bordered"
                            value={projectFilter}
                            onChange={(event) =>
                                setProjectFilter(event.target.value as typeof projectFilter)
                            }
                        >
                            <option value="all">All</option>
                            <option value="assigned">Assigned to a project</option>
                            <option value="unassigned">No project assigned</option>
                        </select>
                    </label>

                    <label className="label cursor-pointer gap-3 md:ml-auto">
                        <span className="label-text text-sm font-medium">Infinite canvas view</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={isCanvasView}
                            onChange={(event) =>
                                setViewMode(event.target.checked ? "canvas" : "list")
                            }
                        />
                    </label>
                    {!canReorderTasks && (
                        <div className="text-xs text-base-content/60">
                            Switch filters to <strong>All</strong> to reorder tasks.
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                    <div className="card-body">
                        <h2 className="card-title">No tasks yet</h2>
                        <p className="text-base-content/70">
                            Execute a task from a project page to see it appear here.
                        </p>
                    </div>
                </div>
            ) : isCanvasView ? (
                <div className="h-full min-h-0 flex-1">
                    <TasksInfiniteCanvas
                        canvasRef={canvasRef}
                        canvasTasks={canvasTasks}
                        projects={projects}
                        viewport={viewport}
                        isMarkingDone={isMarkingDone}
                        isDeleting={isDeleting}
                        isUpdatingProject={isUpdatingProject}
                        isCreatingConnection={isCreatingConnection}
                        connectionDragPreview={connectionDragPreview}
                        onResetView={() => setViewport({ x: 120, y: 120, scale: 1 })}
                        onWheel={handleCanvasWheel}
                        onPointerDown={handleCanvasPointerDown}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onTaskPointerDown={handleTaskPointerDown}
                        onConnectionPointerDown={handleConnectionPointerDown}
                        onMarkDone={markDone}
                        onDeleteTask={deleteTask}
                        onUpdateTaskProject={updateTaskProject}
                    />
                </div>
            ) : (
                <TasksListView
                    tasks={tasks}
                    projects={projects}
                    isMarkingDone={isMarkingDone}
                    isDeleting={isDeleting}
                    isUpdatingProject={isUpdatingProject}
                    isCreatingConnection={isCreatingConnection}
                    isDeletingConnection={isDeletingConnection}
                    isReordering={reorderTasksMutation.isPending}
                    canReorder={canReorderTasks}
                    onMarkDone={markDone}
                    onDeleteTask={deleteTask}
                    onUpdateTaskProject={updateTaskProject}
                    onCreateConnection={createTaskConnection}
                    onDeleteConnection={deleteTaskConnection}
                    onMoveTask={handleMoveTask}
                />
            )}
        </div>
    );
}
