import { randomUUID } from "node:crypto";
import { asc, eq, min } from "drizzle-orm";
import { projects, repositories } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export function listRepositories() {
    const db = getDb();
    return db
        .select({
            id: repositories.id,
            name: repositories.name,
            url: repositories.url,
            projectId: min(projects.id).as("projectId"),
        })
        .from(repositories)
        .leftJoin(projects, eq(projects.repositoryId, repositories.id))
        .groupBy(repositories.id, repositories.name, repositories.url)
        .orderBy(asc(repositories.name))
        .execute();
}

export async function listExistingRepositoryUrls() {
    const db = getDb();
    const existing = await db.select({ url: repositories.url }).from(repositories).execute();
    return new Set(existing.map((row) => row.url));
}

export async function insertRepository(input: { name: string; url: string }) {
    const db = getDb();
    await db
        .insert(repositories)
        .values({ id: randomUUID(), name: input.name, url: input.url })
        .execute();
}
