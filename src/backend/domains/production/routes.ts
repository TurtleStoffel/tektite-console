import type { Server } from "bun";
import { createProductionService } from "./service";

export function createProductionServerRoutes(options: { productionDir: string }) {
    const service = createProductionService({ productionDir: options.productionDir });

    return {
        "/api/production/logs": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const repositoryUrl = url.searchParams.get("repositoryUrl")?.trim() ?? "";
                if (!repositoryUrl) {
                    return new Response(JSON.stringify({ error: "Repository URL is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = await service.getLogs(repositoryUrl);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
        },

        "/api/production/start": {
            async POST(req: Server.Request) {
                let body: unknown;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const parsedBody = body as { repositoryUrl?: unknown };
                const repositoryUrl =
                    typeof parsedBody.repositoryUrl === "string"
                        ? parsedBody.repositoryUrl.trim()
                        : "";
                if (!repositoryUrl) {
                    return new Response(JSON.stringify({ error: "Repository URL is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = await service.start(repositoryUrl);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
        },
    } as const;
}
