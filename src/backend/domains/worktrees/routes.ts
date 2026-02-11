import type { Server } from "bun";
import { createWorktreesService } from "./service";

export function createDevServerRoutes(options: { clonesDir: string }) {
    const service = createWorktreesService({ clonesDir: options.clonesDir });

    return {
        "/api/worktrees/dev-logs": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const rawPath = url.searchParams.get("path")?.trim() ?? "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Worktree path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = service.getDevLogs(rawPath);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
        },

        "/api/worktrees/dev-server": {
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

                const parsedBody = body as { path?: unknown };
                const rawPath = typeof parsedBody.path === "string" ? parsedBody.path.trim() : "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Worktree path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = service.startDevServer(rawPath);
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
