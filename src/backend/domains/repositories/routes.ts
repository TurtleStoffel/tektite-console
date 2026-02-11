import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { createRepositoriesService } from "./service";

type Db = BunSQLiteDatabase<typeof schema>;

export function createRepositoryRoutes(options: { db: Db }) {
    const service = createRepositoriesService({ db: options.db });

    return {
        "/api/repositories": {
            async GET() {
                const data = await service.listRepositories();
                return Response.json({ data });
            },
        },
        "/api/repositories/sync": {
            async POST() {
                try {
                    return Response.json(await service.syncRepositories());
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
