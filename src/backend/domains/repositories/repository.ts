import { randomUUID } from "node:crypto";
import { asc, eq, min } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { projects, repositories } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export function listRepositories(db: Db) {
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

export async function listExistingRepositoryUrls(db: Db) {
    const existing = await db.select({ url: repositories.url }).from(repositories).execute();
    return new Set(existing.map((row) => row.url));
}

export async function insertRepository(db: Db, input: { name: string; url: string }) {
    await db
        .insert(repositories)
        .values({ id: randomUUID(), name: input.name, url: input.url })
        .execute();
}
