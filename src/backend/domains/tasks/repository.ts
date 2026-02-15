import { desc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { projects, taskHistory } from "../../db/local/schema";

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
            repositoryUrl: taskHistory.repositoryUrl,
            prompt: taskHistory.prompt,
            createdAt: taskHistory.createdAt,
        })
        .from(taskHistory)
        .orderBy(desc(taskHistory.createdAt), desc(taskHistory.id))
        .execute();
}

export function listProjectTaskHistory(db: Db, projectId: string) {
    return db
        .select({
            id: taskHistory.id,
            projectId: taskHistory.projectId,
            repositoryUrl: taskHistory.repositoryUrl,
            prompt: taskHistory.prompt,
            createdAt: taskHistory.createdAt,
        })
        .from(taskHistory)
        .where(eq(taskHistory.projectId, projectId))
        .orderBy(desc(taskHistory.createdAt), desc(taskHistory.id))
        .execute();
}

export async function createTaskHistory(
    db: Db,
    values: {
        id: string;
        projectId: string | null;
        repositoryUrl: string;
        prompt: string;
        createdAt: string;
    },
) {
    await db.insert(taskHistory).values(values).execute();
}
