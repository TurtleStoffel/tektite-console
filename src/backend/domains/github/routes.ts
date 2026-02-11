import { createGithubService } from "./service";

export function createGithubRoutes() {
    const service = createGithubService();

    return {
        "/api/github/repos": {
            async GET() {
                try {
                    const repos = await service.listRepos();
                    return Response.json({ repos });
                } catch (error) {
                    console.error("Failed to fetch GitHub repos from gh CLI:", error);
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Unknown error while reading gh CLI output.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
