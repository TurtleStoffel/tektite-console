import { randomUUID } from "node:crypto";
import * as repository from "./repository";

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

export const tasksService = {
    async listTaskHistory() {
        const rows = await repository.listTaskHistory();
        return rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            prompt: row.prompt,
            createdAt: row.createdAt,
            isDone: row.isDone,
            doneAt: row.doneAt,
        }));
    },

    async listProjectTaskHistory(projectId: string, filter?: { isDone?: boolean }) {
        const project = await repository.findProject(projectId);
        if (!project) return { error: "Project not found.", status: 404 as const };

        const rows = await repository.listProjectTaskHistory(projectId, filter);
        return rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            prompt: row.prompt,
            createdAt: row.createdAt,
            isDone: row.isDone,
            doneAt: row.doneAt,
        }));
    },

    async createTaskHistory(input: { projectId?: string | null; prompt: string }) {
        const projectId = normalizeProjectId(input.projectId);
        if (projectId) {
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();
        await repository.createTaskHistory({
            id,
            projectId,
            prompt: input.prompt,
            createdAt,
            isDone: false,
            doneAt: null,
        });
        console.info("[tasks] created task history", { id, projectId });
        return {
            id,
            projectId,
            prompt: input.prompt,
            createdAt,
            isDone: false,
            doneAt: null,
        };
    },

    async markTaskHistoryDone(taskId: string) {
        const task = await repository.findTaskHistoryById(taskId);
        if (!task) return { error: "Task not found.", status: 404 as const };
        if (task.isDone) return task;

        const doneAt = new Date().toISOString();
        await repository.markTaskHistoryDone(taskId, doneAt);
        console.info("[tasks] marked task done", { taskId, doneAt });
        return { ...task, isDone: true, doneAt };
    },
};
