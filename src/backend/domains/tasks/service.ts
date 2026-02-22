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
};
