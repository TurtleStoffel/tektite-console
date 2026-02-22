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
            prompt: row.prompt,
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
            prompt: row.prompt,
            createdAt: row.createdAt,
            isDone: row.isDone,
            doneAt: row.doneAt,
        }));
    },

    async createTask(input: { projectId?: string | null; prompt: string }) {
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
            prompt: input.prompt,
            createdAt,
            isDone: false,
            doneAt: null,
        });
        console.info("[tasks] created task", { id, projectId });
        return {
            id,
            projectId,
            prompt: input.prompt,
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

    async deleteTask(taskId: string) {
        const task = await repository.findTaskById(taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };

        await repository.deleteTask(taskId);
        console.info("[tasks] deleted task", { taskId });
        return task;
    },
};
