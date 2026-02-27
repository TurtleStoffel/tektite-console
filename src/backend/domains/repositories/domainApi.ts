import { listGithubRepos } from "@/backend/domains/git/service";
import * as repository from "./repository";

export const repositoriesService = {
    async listRepositories() {
        const rows = await repository.listRepositories();
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            url: row.url,
            projectId: row.projectId ?? null,
        }));
    },

    async syncRepositories() {
        console.info("[repositories] syncing from GitHub");
        const repos = await listGithubRepos();
        const existingUrls = await repository.listExistingRepositoryUrls();

        let insertedCount = 0;
        for (const repo of repos) {
            const url = typeof repo.url === "string" ? repo.url.trim() : "";
            if (!url || existingUrls.has(url)) continue;

            const name = typeof repo.name === "string" ? repo.name.trim() : "";
            if (!name) continue;

            await repository.insertRepository({ name, url });
            existingUrls.add(url);
            insertedCount += 1;
        }

        console.info("[repositories] sync complete", { insertedCount, total: repos.length });
        return { insertedCount, total: repos.length };
    },
};
