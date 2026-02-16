import { randomUUID } from "node:crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

export function createTasksService(options: { db: Db }) {
    const { db } = options;

    return {
        async listTaskHistory() {
            const rows = await repository.listTaskHistory(db);
            return rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                prompt: row.prompt,
                createdAt: row.createdAt,
                isDone: row.isDone,
                doneAt: row.doneAt,
            }));
        },

        async listProjectTaskHistory(projectId: string) {
            const project = await repository.findProject(db, projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };

            const rows = await repository.listProjectTaskHistory(db, projectId);
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
                const project = await repository.findProject(db, projectId);
                if (!project) return { error: "Project not found.", status: 404 as const };
            }

            const id = randomUUID();
            const createdAt = new Date().toISOString();
            await repository.createTaskHistory(db, {
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
            const task = await repository.findTaskHistoryById(db, taskId);
            if (!task) return { error: "Task not found.", status: 404 as const };
            if (task.isDone) return task;

            const doneAt = new Date().toISOString();
            await repository.markTaskHistoryDone(db, taskId, doneAt);
            console.info("[tasks] marked task done", { taskId, doneAt });
            return { ...task, isDone: true, doneAt };
        },
    };
}
