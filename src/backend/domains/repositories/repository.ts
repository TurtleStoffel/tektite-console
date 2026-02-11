import { randomUUID } from "node:crypto";
import { asc, eq, min } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { GithubRepo } from "../../../shared/github";
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

export async function fetchGithubRepos(): Promise<GithubRepo[]> {
    const repoFields = ["name", "owner", "description", "visibility", "url", "updatedAt"].join(",");

    const process = Bun.spawn(["gh", "repo", "list", "--limit", "100", "--json", repoFields], {
        stdout: "pipe",
        stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
    ]);

    if (exitCode !== 0) {
        throw new Error(stderr.trim() || "Unable to list repositories via gh CLI.");
    }

    try {
        const parsed = JSON.parse(stdout);
        return parsed;
    } catch {
        throw new Error("Received invalid JSON from gh CLI.");
    }
}
