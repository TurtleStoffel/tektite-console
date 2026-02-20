import { and, desc, eq } from "drizzle-orm";
import { projects, taskHistory } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export async function findProject(projectId: string) {
    const db = getDb();
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function listTaskHistory() {
    const db = getDb();
    return db
        .select({
            id: taskHistory.id,
            projectId: taskHistory.projectId,
            prompt: taskHistory.prompt,
            createdAt: taskHistory.createdAt,
            isDone: taskHistory.isDone,
            doneAt: taskHistory.doneAt,
        })
        .from(taskHistory)
        .orderBy(desc(taskHistory.createdAt), desc(taskHistory.id))
        .execute();
}

export function listProjectTaskHistory(projectId: string, filter: { isDone?: boolean } = {}) {
    const db = getDb();
    const whereClause =
        filter.isDone === undefined
            ? eq(taskHistory.projectId, projectId)
            : and(eq(taskHistory.projectId, projectId), eq(taskHistory.isDone, filter.isDone));

    return db
        .select({
            id: taskHistory.id,
            projectId: taskHistory.projectId,
            prompt: taskHistory.prompt,
            createdAt: taskHistory.createdAt,
            isDone: taskHistory.isDone,
            doneAt: taskHistory.doneAt,
        })
        .from(taskHistory)
        .where(whereClause)
        .orderBy(desc(taskHistory.createdAt), desc(taskHistory.id))
        .execute();
}

export async function findTaskHistoryById(taskId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: taskHistory.id,
            projectId: taskHistory.projectId,
            prompt: taskHistory.prompt,
            createdAt: taskHistory.createdAt,
            isDone: taskHistory.isDone,
            doneAt: taskHistory.doneAt,
        })
        .from(taskHistory)
        .where(eq(taskHistory.id, taskId))
        .execute();
    return rows[0] ?? null;
}

export async function createTaskHistory(values: {
    id: string;
    projectId: string | null;
    prompt: string;
    createdAt: string;
    isDone: boolean;
    doneAt: string | null;
}) {
    const db = getDb();
    await db.insert(taskHistory).values(values).execute();
}

export async function markTaskHistoryDone(taskId: string, doneAt: string) {
    const db = getDb();
    await db
        .update(taskHistory)
        .set({
            isDone: true,
            doneAt,
        })
        .where(eq(taskHistory.id, taskId))
        .execute();
}
