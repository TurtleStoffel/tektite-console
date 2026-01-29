import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { randomUUID } from "node:crypto";
import { asc, eq, min } from "drizzle-orm";
import type * as schema from "../db/schema";
import { projects, repositories } from "../db/schema";
import type { GithubRepo } from "../../types/github";

async function fetchGithubRepos(): Promise<GithubRepo[]> {
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

type Db = BunSQLiteDatabase<typeof schema>;

export function createRepositoryRoutes(options: { db: Db }) {
    const { db } = options;

    return {
        "/api/repositories": {
            async GET() {
                const rows = db
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
                    .all();

                const repositoriesList = rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    url: row.url,
                    projectId: row.projectId ?? null,
                }));

                return Response.json({ data: repositoriesList });
            },
        },
        "/api/repositories/sync": {
            async POST() {
                try {
                    console.info("[repositories] syncing from GitHub");
                    const repos = await fetchGithubRepos();
                    const existing = db
                        .select({ url: repositories.url })
                        .from(repositories)
                        .all();
                    const existingUrls = new Set(existing.map((row) => row.url));

                    let insertedCount = 0;
                    for (const repo of repos) {
                        const url = typeof repo.url === "string" ? repo.url.trim() : "";
                        if (!url || existingUrls.has(url)) {
                            continue;
                        }
                        const name = typeof repo.name === "string" ? repo.name.trim() : "";
                        if (!name) {
                            continue;
                        }
                        db.insert(repositories)
                            .values({ id: randomUUID(), name, url })
                            .run();
                        existingUrls.add(url);
                        insertedCount += 1;
                    }

                    console.info("[repositories] sync complete", {
                        insertedCount,
                        total: repos.length,
                    });
                    return Response.json({ insertedCount, total: repos.length });
                } catch (error) {
                    console.error("[repositories] sync failed", error);
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Unknown error while syncing repositories.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
