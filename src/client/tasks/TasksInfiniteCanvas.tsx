import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { CanvasPoint, ProjectOption, TaskItem, Viewport } from "./types";

type CanvasTask = TaskItem & { canvasPosition: CanvasPoint };

type TasksInfiniteCanvasProps = {
    canvasRef: React.RefObject<HTMLDivElement | null>;
    canvasTasks: CanvasTask[];
    projects: ProjectOption[];
    viewport: Viewport;
    isMarkingDone: boolean;
    isDeleting: boolean;
    isUpdatingProject: boolean;
    isCreatingConnection: boolean;
    connectionDragPreview: {
        fromTaskId: string;
        toPoint: CanvasPoint;
    } | null;
    onResetView: () => void;
    onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onTaskPointerDown: (task: CanvasTask, event: ReactPointerEvent<HTMLElement>) => void;
    onConnectionPointerDown: (task: CanvasTask, event: ReactPointerEvent<HTMLElement>) => void;
    onMarkDone: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTaskProject: (input: { taskId: string; projectId: string | null }) => void;
};

const NODE_WIDTH = 320;
const NODE_HEIGHT = 170;

export function TasksInfiniteCanvas({
    canvasRef,
    canvasTasks,
    projects,
    viewport,
    isMarkingDone,
    isDeleting,
    isUpdatingProject,
    isCreatingConnection,
    connectionDragPreview,
    onResetView,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTaskPointerDown,
    onConnectionPointerDown,
    onMarkDone,
    onDeleteTask,
    onUpdateTaskProject,
}: TasksInfiniteCanvasProps) {
    const canvasConnections = new Set<string>();
    for (const task of canvasTasks) {
        for (const connectedTaskId of task.connectionTaskIds) {
            if (task.id < connectedTaskId) {
                canvasConnections.add(`${task.id}:${connectedTaskId}`);
            }
        }
    }

    const taskById = new Map(canvasTasks.map((task) => [task.id, task]));

    return (
        <div className="card bg-base-200 border border-base-300 shadow-md h-full">
            <div className="card-body p-3 flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between px-1 pb-2">
                    <p className="text-xs text-base-content/70">
                        Drag tasks to arrange, drag empty space to pan, and use the wheel to zoom.
                    </p>
                    <button type="button" className="btn btn-xs btn-outline" onClick={onResetView}>
                        Reset view
                    </button>
                </div>
                <div
                    ref={canvasRef}
                    className="relative h-full min-h-0 overflow-hidden rounded-xl border border-base-300 bg-base-100"
                    onWheel={onWheel}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
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
                            className="absolute overflow-visible pointer-events-none"
                            style={{ top: 0, left: 0 }}
                            aria-hidden="true"
                        >
                            {[...canvasConnections].map((connectionKey) => {
                                const [sourceTaskId, targetTaskId] = connectionKey.split(":");
                                if (!sourceTaskId || !targetTaskId) {
                                    return null;
                                }
                                const sourceTask = taskById.get(sourceTaskId);
                                const targetTask = taskById.get(targetTaskId);
                                if (!sourceTask || !targetTask) {
                                    return null;
                                }

                                const x1 = sourceTask.canvasPosition.x + NODE_WIDTH / 2;
                                const y1 = sourceTask.canvasPosition.y + NODE_HEIGHT / 2;
                                const x2 = targetTask.canvasPosition.x + NODE_WIDTH / 2;
                                const y2 = targetTask.canvasPosition.y + NODE_HEIGHT / 2;

                                return (
                                    <line
                                        key={connectionKey}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                                        strokeWidth={2}
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
                                onPointerDown={(event) => onTaskPointerDown(task, event)}
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
                                            onConnectionPointerDown(task, event)
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
