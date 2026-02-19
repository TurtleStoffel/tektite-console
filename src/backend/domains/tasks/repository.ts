import { and, asc, desc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { projects, repositories, taskHistory } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export async function findProject(db: Db, projectId: string) {
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function listTaskHistory(db: Db) {
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

export function listProjectTaskHistory(
    db: Db,
    projectId: string,
    filter: { isDone?: boolean } = {},
) {
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

export async function findTaskHistoryById(db: Db, taskId: string) {
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

export async function createTaskHistory(
    db: Db,
    values: {
        id: string;
        projectId: string | null;
        prompt: string;
        createdAt: string;
        isDone: boolean;
        doneAt: string | null;
    },
) {
    await db.insert(taskHistory).values(values).execute();
}

export async function markTaskHistoryDone(db: Db, taskId: string, doneAt: string) {
    await db
        .update(taskHistory)
        .set({
            isDone: true,
            doneAt,
        })
        .where(eq(taskHistory.id, taskId))
        .execute();
}

export function listProjectsWithRepositoryUrls(db: Db) {
    return db
        .select({
            projectId: projects.id,
            repositoryUrl: repositories.url,
        })
        .from(projects)
        .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
        .execute();
}

export function listPendingProjectTasks(db: Db, projectId: string) {
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
        .where(and(eq(taskHistory.projectId, projectId), eq(taskHistory.isDone, false)))
        .orderBy(asc(taskHistory.createdAt), asc(taskHistory.id))
        .execute();
}
