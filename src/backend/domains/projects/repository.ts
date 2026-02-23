import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { projects, repositories, worktreePromptSummaries } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export function listProjects() {
    const db = getDb();
    return db
        .select({
            id: projects.id,
            name: projects.name,
            repositoryId: projects.repositoryId,
            url: repositories.url,
        })
        .from(projects)
        .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
        .orderBy(asc(projects.sortOrder), asc(projects.name), asc(projects.id))
        .execute();
}

export async function listProjectIds() {
    const db = getDb();
    const rows = await db.select({ id: projects.id }).from(projects).execute();
    return rows.map((row) => row.id);
}

export async function getNextProjectSortOrder() {
    const db = getDb();
    const rows = await db
        .select({
            nextSortOrder: sql<number>`coalesce(max(${projects.sortOrder}), -1) + 1`,
        })
        .from(projects)
        .execute();
    return rows[0]?.nextSortOrder ?? 0;
}

export async function findRepositoryById(repositoryId: string) {
    const db = getDb();
    const rows = await db
        .select({ id: repositories.id, url: repositories.url })
        .from(repositories)
        .where(eq(repositories.id, repositoryId))
        .execute();
    return rows[0] ?? null;
}

export async function hasProjectForRepository(repositoryId: string) {
    const db = getDb();
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.repositoryId, repositoryId))
        .execute();
    return Boolean(rows[0]);
}

export async function hasOtherProjectForRepository(options: {
    projectId: string;
    repositoryId: string;
}) {
    const db = getDb();
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

export async function createProject(values: {
    id: string;
    name: string;
    sortOrder: number;
    repositoryId: string | null;
}) {
    const db = getDb();
    await db.insert(projects).values(values).execute();
}

export async function reorderProjects(orderedProjectIds: string[]) {
    const db = getDb();
    await db.transaction(async (tx) => {
        for (const [sortOrder, projectId] of orderedProjectIds.entries()) {
            await tx
                .update(projects)
                .set({ sortOrder })
                .where(eq(projects.id, projectId))
                .execute();
        }
    });
}

export async function findProjectById(projectId: string) {
    const db = getDb();
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

export function updateProjectRepository(options: {
    projectId: string;
    repositoryId: string | null;
}) {
    const db = getDb();
    return db
        .update(projects)
        .set({ repositoryId: options.repositoryId })
        .where(eq(projects.id, options.projectId))
        .returning({ id: projects.id })
        .execute();
}

export function deleteProject(projectId: string) {
    const db = getDb();
    return db
        .delete(projects)
        .where(eq(projects.id, projectId))
        .returning({ id: projects.id })
        .execute();
}

export function listWorktreePromptSummariesByPaths(worktreePaths: string[]) {
    const db = getDb();
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
