import { repositoriesService } from "./domainApi";

export function createRepositoryRoutes() {
    return {
        "/api/repositories": {
            async GET() {
                const data = await repositoriesService.listRepositories();
                return Response.json({ data });
            },
        },
        "/api/repositories/sync": {
            async POST() {
                try {
                    return Response.json(await repositoriesService.syncRepositories());
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
