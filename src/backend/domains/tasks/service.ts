import { randomUUID } from "node:crypto";
import { Result } from "typescript-result";
import * as repository from "./repository";

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

export const tasksService = {
    async listTasks(filter?: { isDone?: boolean; hasProject?: boolean }) {
        const rows = filter
            ? await repository.listTasksWithFilter(filter)
            : await repository.listTasks();
        return rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            description: row.description,
            createdAt: row.createdAt,
            isDone: row.isDone,
            doneAt: row.doneAt,
            canvasPosition:
                row.canvasPositionX !== null && row.canvasPositionY !== null
                    ? { x: row.canvasPositionX, y: row.canvasPositionY }
                    : null,
        }));
    },

    async listProjectTasks(projectId: string, filter?: { isDone?: boolean }) {
        const project = await repository.findProject(projectId);
        if (!project) return { error: "Project not found.", status: 404 as const };

        const rows = await repository.listProjectTasks(projectId, filter);
        return rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            description: row.description,
            createdAt: row.createdAt,
            isDone: row.isDone,
            doneAt: row.doneAt,
            canvasPosition:
                row.canvasPositionX !== null && row.canvasPositionY !== null
                    ? { x: row.canvasPositionX, y: row.canvasPositionY }
                    : null,
        }));
    },

    async createTask(input: { projectId?: string | null; description: string }) {
        const projectId = normalizeProjectId(input.projectId);
        if (projectId) {
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();
        await repository.createTask({
            id,
            projectId,
            description: input.description,
            createdAt,
            isDone: false,
            doneAt: null,
        });
        console.info("[tasks] created task", { id, projectId });
        return {
            id,
            projectId,
            description: input.description,
            createdAt,
            isDone: false,
            doneAt: null,
        };
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
        return { ...task, isDone: true, doneAt };
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
        return task;
    },

    async updateTaskProject(input: { taskId: string; projectId?: string | null }) {
        const task = await repository.findTaskById(input.taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };

        const projectId = normalizeProjectId(input.projectId);
        if (projectId) {
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        await repository.updateTaskProject({
            taskId: input.taskId,
            projectId,
        });
        console.info("[tasks] updated task project", { taskId: input.taskId, projectId });
        return {
            ...task,
            projectId,
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
