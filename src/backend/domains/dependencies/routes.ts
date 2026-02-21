import { createDependencyService } from "./domainApi";

export function createDependencyRoutes() {
    const service = createDependencyService();

    return {
        "/api/dependencies/graph": {
            async GET(req: Request) {
                const url = new URL(req.url);
                const targetPath = url.searchParams.get("path")?.trim();
                if (!targetPath) {
                    return new Response(
                        JSON.stringify({ error: "Query parameter `path` is required." }),
                        {
                            status: 400,
                        },
                    );
                }

                const graphResult = await service.generateGraphData(targetPath);
                if (!graphResult.ok) {
                    const status = graphResult.error.type === "dependency-graph-error" ? 500 : 400;
                    return new Response(JSON.stringify({ error: graphResult.error.message }), {
                        status,
                    });
                }
                return new Response(JSON.stringify({ data: graphResult.value }), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store",
                    },
                });
            },
        },
    } as const;
}
