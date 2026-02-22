import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage } from "./utils/errors";

type TasksPageProps = {
    drawerToggleId: string;
};

type TaskItem = {
    id: string;
    projectId: string | null;
    description: string;
    isDone: boolean;
    doneAt: string | null;
    canvasPosition: {
        x: number;
        y: number;
    } | null;
};

type ProjectOption = {
    id: string;
    name: string | null;
};

type CanvasPoint = {
    x: number;
    y: number;
};

type Viewport = {
    x: number;
    y: number;
    scale: number;
};

const NODE_WIDTH = 320;
const NODE_HEIGHT = 170;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_SENSITIVITY = 0.0015;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getDefaultNodePosition(index: number): CanvasPoint {
    const columns = 5;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
        x: 120 + column * (NODE_WIDTH + 24),
        y: 120 + row * (NODE_HEIGHT + 24),
    };
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
    const viewportRef = useRef<Viewport>({ x: 120, y: 120, scale: 1 });

    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
    const [projectFilter, setProjectFilter] = useState<"all" | "assigned" | "unassigned">("all");
    const [viewMode, setViewMode] = useState<"list" | "canvas">("list");
    const [viewport, setViewport] = useState<Viewport>({ x: 120, y: 120, scale: 1 });
    const [positionOverrides, setPositionOverrides] = useState<Record<string, CanvasPoint>>({});

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

            if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
                (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
            }
        },
        [positionOverrides, saveTaskCanvasPosition, tasksById],
    );

    return (
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 relative z-10">
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
                            checked={viewMode === "canvas"}
                            onChange={(event) =>
                                setViewMode(event.target.checked ? "canvas" : "list")
                            }
                        />
                    </label>
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
            ) : viewMode === "list" ? (
                <div className="overflow-x-auto card bg-base-200 border border-base-300 shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>State</th>
                                <th>Project</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task) => (
                                <tr key={task.id}>
                                    <td className="whitespace-nowrap">
                                        <span
                                            className={`badge ${
                                                task.isDone ? "badge-success" : "badge-warning"
                                            }`}
                                        >
                                            {task.isDone ? "Done" : "In progress"}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap text-sm text-base-content/80">
                                        <label className="form-control w-52">
                                            <select
                                                className="select select-bordered select-xs"
                                                value={task.projectId ?? ""}
                                                disabled={
                                                    isMarkingDone || isDeleting || isUpdatingProject
                                                }
                                                onChange={(event) => {
                                                    const nextProjectId =
                                                        event.target.value.trim() || null;
                                                    updateTaskProject({
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
                                        </label>
                                    </td>
                                    <td className="text-sm">{task.description}</td>
                                    <td className="whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-success"
                                                disabled={
                                                    task.isDone || isMarkingDone || isDeleting
                                                }
                                                onClick={() => markDone(task.id)}
                                            >
                                                Mark done
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-error btn-outline"
                                                disabled={isMarkingDone || isDeleting}
                                                onClick={() => {
                                                    if (!window.confirm("Delete this task?"))
                                                        return;
                                                    deleteTask(task.id);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="card bg-base-200 border border-base-300 shadow-md">
                    <div className="card-body p-3">
                        <div className="flex items-center justify-between px-1 pb-2">
                            <p className="text-xs text-base-content/70">
                                Drag tasks to arrange, drag empty space to pan, and use the wheel to
                                zoom.
                            </p>
                            <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                onClick={() => setViewport({ x: 120, y: 120, scale: 1 })}
                            >
                                Reset view
                            </button>
                        </div>
                        <div
                            ref={canvasRef}
                            className="relative h-[70vh] overflow-hidden rounded-xl border border-base-300 bg-base-100"
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
                                {canvasTasks.map((task) => (
                                    <article
                                        key={task.id}
                                        className="absolute bg-base-200 border border-base-300 rounded-lg shadow-md p-3 select-none"
                                        style={{
                                            width: NODE_WIDTH,
                                            minHeight: NODE_HEIGHT,
                                            left: task.canvasPosition.x,
                                            top: task.canvasPosition.y,
                                        }}
                                        onPointerDown={(event) => {
                                            event.stopPropagation();
                                            const world = screenToWorld(
                                                event.clientX,
                                                event.clientY,
                                            );
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
                                        }}
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
                                                disabled={
                                                    isMarkingDone || isDeleting || isUpdatingProject
                                                }
                                                onChange={(event) => {
                                                    const nextProjectId =
                                                        event.target.value.trim() || null;
                                                    updateTaskProject({
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
                                                className="btn btn-xs btn-success"
                                                disabled={
                                                    task.isDone || isMarkingDone || isDeleting
                                                }
                                                onClick={() => markDone(task.id)}
                                            >
                                                Done
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-error btn-outline"
                                                disabled={isMarkingDone || isDeleting}
                                                onClick={() => {
                                                    if (!window.confirm("Delete this task?"))
                                                        return;
                                                    deleteTask(task.id);
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
            )}
        </div>
    );
}
