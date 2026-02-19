import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { projects, repositories, worktreePromptSummaries } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export function listProjects(db: Db) {
    return db
        .select({
            id: projects.id,
            name: projects.name,
            repositoryId: projects.repositoryId,
            url: repositories.url,
        })
        .from(projects)
        .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
        .orderBy(asc(projects.name))
        .execute();
}

export async function findRepositoryById(db: Db, repositoryId: string) {
    const rows = await db
        .select({ id: repositories.id, url: repositories.url })
        .from(repositories)
        .where(eq(repositories.id, repositoryId))
        .execute();
    return rows[0] ?? null;
}

export async function hasProjectForRepository(db: Db, repositoryId: string) {
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.repositoryId, repositoryId))
        .execute();
    return Boolean(rows[0]);
}

export async function hasOtherProjectForRepository(
    db: Db,
    options: { projectId: string; repositoryId: string },
) {
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
            and(
                eq(projects.repositoryId, options.repositoryId),
                ne(projects.id, options.projectId),
            ),
        )
        .execute();
    return Boolean(rows[0]);
}

export async function createProject(
    db: Db,
    values: { id: string; name: string; repositoryId: string | null },
) {
    await db.insert(projects).values(values).execute();
}

export async function findProjectById(db: Db, projectId: string) {
    const rows = await db
        .select({
            id: projects.id,
            name: projects.name,
            repositoryId: projects.repositoryId,
            url: repositories.url,
        })
        .from(projects)
        .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function updateProjectRepository(
    db: Db,
    options: { projectId: string; repositoryId: string | null },
) {
    return db
        .update(projects)
        .set({ repositoryId: options.repositoryId })
        .where(eq(projects.id, options.projectId))
        .returning({ id: projects.id })
        .execute();
}

export function deleteProject(db: Db, projectId: string) {
    return db
        .delete(projects)
        .where(eq(projects.id, projectId))
        .returning({ id: projects.id })
        .execute();
}

export function listWorktreePromptSummariesByPaths(db: Db, worktreePaths: string[]) {
    if (worktreePaths.length === 0) {
        return Promise.resolve([]);
    }

    return db
        .select({
            worktreePath: worktreePromptSummaries.worktreePath,
            promptSummary: worktreePromptSummaries.promptSummary,
        })
        .from(worktreePromptSummaries)
        .where(inArray(worktreePromptSummaries.worktreePath, worktreePaths))
        .execute();
}
