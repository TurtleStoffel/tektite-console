import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
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

export function createRepositoryRoutes(options: { db: Database }) {
    const { db } = options;

    return {
        "/api/repositories": {
            async GET() {
                const rows = db
                    .query(
                        `
                        SELECT
                            repositories.id,
                            repositories.name,
                            repositories.url,
                            MIN(projects.id) AS project_id
                        FROM repositories
                        LEFT JOIN projects ON projects.repository_id = repositories.id
                        GROUP BY repositories.id, repositories.name, repositories.url
                        ORDER BY repositories.name ASC
                        `,
                    )
                    .all() as Array<{
                    id: string;
                    name: string;
                    url: string;
                    project_id: string | null;
                }>;

                const repositories = rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    url: row.url,
                    projectId: row.project_id,
                }));

                return Response.json({ data: repositories });
            },
        },
        "/api/repositories/sync": {
            async POST() {
                try {
                    console.info("[repositories] syncing from GitHub");
                    const repos = await fetchGithubRepos();
                    const existing = db.query("SELECT url FROM repositories").all() as Array<{
                        url: string;
                    }>;
                    const existingUrls = new Set(existing.map((row) => row.url));
                    const insert = db.query(
                        "INSERT INTO repositories (id, name, url) VALUES (?, ?, ?)",
                    );

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
                        insert.run(randomUUID(), name, url);
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
