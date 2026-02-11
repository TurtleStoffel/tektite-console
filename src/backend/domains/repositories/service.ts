import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { createGithubService } from "../github/service";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

export function createRepositoriesService(options: { db: Db }) {
    const { db } = options;
    const githubService = createGithubService();

    return {
        async listRepositories() {
            const rows = await repository.listRepositories(db);
            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                url: row.url,
                projectId: row.projectId ?? null,
            }));
        },

        async syncRepositories() {
            console.info("[repositories] syncing from GitHub");
            const repos = await githubService.listRepos();
            const existingUrls = await repository.listExistingRepositoryUrls(db);

            let insertedCount = 0;
            for (const repo of repos) {
                const url = typeof repo.url === "string" ? repo.url.trim() : "";
                if (!url || existingUrls.has(url)) continue;

                const name = typeof repo.name === "string" ? repo.name.trim() : "";
                if (!name) continue;

                await repository.insertRepository(db, { name, url });
                existingUrls.add(url);
                insertedCount += 1;
            }

            console.info("[repositories] sync complete", { insertedCount, total: repos.length });
            return { insertedCount, total: repos.length };
        },
    };
}
