import { randomUUID } from "node:crypto";
import { Result } from "typescript-result";
import * as repository from "./repository";

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

function buildTaskConnectionMap(
    taskIds: string[],
    pairs: { sourceTaskId: string; targetTaskId: string }[],
) {
    const taskIdSet = new Set(taskIds);
    const map = new Map<string, string[]>();
    for (const taskId of taskIdSet) {
        map.set(taskId, []);
    }

    for (const pair of pairs) {
        if (taskIdSet.has(pair.sourceTaskId) && taskIdSet.has(pair.targetTaskId)) {
            map.get(pair.sourceTaskId)?.push(pair.targetTaskId);
        }
    }

    for (const connectedTaskIds of map.values()) {
        connectedTaskIds.sort((a, b) => a.localeCompare(b));
    }

    return map;
}

function mapTaskRows(
    rows: Array<{
        id: string;
        sortOrder: number;
        projectId: string | null;
        description: string;
        createdAt: string;
        isDone: boolean;
        doneAt: string | null;
        canvasPositionX: number | null;
        canvasPositionY: number | null;
    }>,
    taskConnectionMap: Map<string, string[]>,
) {
    return rows.map((row) => ({
        id: row.id,
        sortOrder: row.sortOrder,
        projectId: row.projectId,
        description: row.description,
        createdAt: row.createdAt,
        isDone: row.isDone,
        doneAt: row.doneAt,
        connectionTaskIds: taskConnectionMap.get(row.id) ?? [],
        canvasPosition:
            row.canvasPositionX !== null && row.canvasPositionY !== null
                ? { x: row.canvasPositionX, y: row.canvasPositionY }
                : null,
    }));
}

export const tasksService = {
    async listTasks(filter?: { isDone?: boolean; hasProject?: boolean }) {
        const rows = filter
            ? await repository.listTasksWithFilter(filter)
            : await repository.listTasks();
        const taskConnections = await repository.listTaskConnections();
        const taskConnectionMap = buildTaskConnectionMap(
            rows.map((row) => row.id),
            taskConnections,
        );
        return mapTaskRows(rows, taskConnectionMap);
    },

    async listProjectTasks(projectId: string, filter?: { isDone?: boolean }) {
        const project = await repository.findProject(projectId);
        if (!project) return { error: "Project not found.", status: 404 as const };

        const rows = await repository.listProjectTasks(projectId, filter);
        const taskConnections = await repository.listTaskConnections();
        const taskConnectionMap = buildTaskConnectionMap(
            rows.map((row) => row.id),
            taskConnections,
        );
        return mapTaskRows(rows, taskConnectionMap);
    },

    async createTask(input: { projectId?: string | null; description: string }) {
        const projectId = normalizeProjectId(input.projectId);
        if (projectId) {
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();
        const sortOrder = await repository.getNextTaskSortOrder();
        await repository.createTask({
            id,
            projectId,
            description: input.description,
            createdAt,
            sortOrder,
            isDone: false,
            doneAt: null,
        });
        console.info("[tasks] created task", { id, projectId });
        return {
            id,
            sortOrder,
            projectId,
            description: input.description,
            createdAt,
            isDone: false,
            doneAt: null,
            connectionTaskIds: [],
        };
    },

    async reorderTasks(input: { taskId: string; sortOrder: number }) {
        const updated = await repository.updateTaskSortOrder(input);
        if (updated.length === 0) {
            return { error: "Task not found.", status: 404 as const };
        }

        console.info("[tasks] reordered", input);
        return { reordered: 1 };
    },

    async getTaskById(taskId: string) {
        const task = await repository.findTaskById(taskId);
        if (!task) {
            return Result.error({
                type: "task-not-found" as const,
                message: "Task not found.",
            });
        }
        return Result.ok(task);
    },

    async markTaskDone(taskId: string) {
        const task = await repository.findTaskById(taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };
        if (task.isDone) return task;

        const doneAt = new Date().toISOString();
        await repository.markTaskDone(taskId, doneAt);
        console.info("[tasks] marked task done", { taskId, doneAt });
        const taskConnections = await repository.listTaskConnections();
        const taskConnectionMap = buildTaskConnectionMap([task.id], taskConnections);
        return {
            ...task,
            isDone: true,
            doneAt,
            connectionTaskIds: taskConnectionMap.get(task.id) ?? [],
        };
    },

    async markTasksDoneByWorktreePath(worktreePath: string) {
        const tasks = await repository.listTasksByWorktreePath(worktreePath);
        if (tasks.length === 0) {
            console.info("[tasks] no tasks linked to worktree", { worktreePath });
            return { totalMatched: 0, totalMarkedDone: 0 };
        }

        const doneAt = new Date().toISOString();
        let totalMarkedDone = 0;
        for (const task of tasks) {
            if (task.isDone) {
                continue;
            }
            await repository.markTaskDone(task.id, doneAt);
            totalMarkedDone += 1;
            console.info("[tasks] marked task done from worktree cleanup", {
                taskId: task.id,
                worktreePath,
                doneAt,
            });
        }

        return { totalMatched: tasks.length, totalMarkedDone };
    },

    async setTaskWorktreePath(taskId: string, worktreePath: string) {
        const task = await repository.findTaskById(taskId);
        if (!task) {
            return Result.error({
                type: "task-not-found" as const,
                message: "Task not found.",
            });
        }
        if (!task.projectId) {
            return Result.error({
                type: "task-project-missing" as const,
                message: "Task is not linked to a project.",
            });
        }

        await repository.setTaskWorktreePath(taskId, worktreePath);
        console.info("[tasks] set task worktree path", { taskId, worktreePath });

        return Result.ok({
            ...task,
            worktreePath,
        });
    },

    async deleteTask(taskId: string) {
        const task = await repository.findTaskById(taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };

        await repository.deleteTask(taskId);
        console.info("[tasks] deleted task", { taskId });
        const taskConnections = await repository.listTaskConnections();
        const taskConnectionMap = buildTaskConnectionMap([task.id], taskConnections);
        return {
            ...task,
            connectionTaskIds: taskConnectionMap.get(task.id) ?? [],
        };
    },

    async updateTask(input: { taskId: string; projectId?: string | null; description?: string }) {
        const task = await repository.findTaskById(input.taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };

        const projectId =
            input.projectId === undefined ? undefined : normalizeProjectId(input.projectId);
        if (projectId !== undefined && projectId) {
            const project = await repository.findProject(projectId);
            if (!project) {
                return { error: "Project not found.", status: 404 as const };
            }
        }

        if (projectId !== undefined) {
            await repository.updateTaskProject({
                taskId: input.taskId,
                projectId,
            });
        }
        if (input.description !== undefined) {
            await repository.updateTaskDescription({
                taskId: input.taskId,
                description: input.description,
            });
        }

        console.info("[tasks] updated task", {
            taskId: input.taskId,
            projectId,
            hasDescriptionUpdate: input.description !== undefined,
        });
        const taskConnections = await repository.listTaskConnections();
        const taskConnectionMap = buildTaskConnectionMap([task.id], taskConnections);
        return {
            ...task,
            projectId: projectId === undefined ? task.projectId : projectId,
            description: input.description ?? task.description,
            connectionTaskIds: taskConnectionMap.get(task.id) ?? [],
        };
    },

    async updateTaskCanvasPosition(input: { taskId: string; x: number; y: number }) {
        const task = await repository.findTaskById(input.taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };

        await repository.upsertTaskCanvasPosition(input);
        console.info("[tasks] updated task canvas position", {
            taskId: input.taskId,
            x: input.x,
            y: input.y,
        });

        return {
            taskId: input.taskId,
            x: input.x,
            y: input.y,
        };
    },
};
