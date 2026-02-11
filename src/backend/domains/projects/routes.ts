import type { Server } from "bun";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { createProjectsService } from "./service";

export function createProjectRoutes(options: {
    db: BunSQLiteDatabase<typeof schema>;
    clonesDir: string;
    productionDir: string;
}) {
    const service = createProjectsService({
        db: options.db,
        clonesDir: options.clonesDir,
        productionDir: options.productionDir,
    });

    return {
        "/api/projects": {
            async GET() {
                const data = await service.listProjects();
                return Response.json({ data });
            },
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

                const parsedBody = body as { name?: unknown; repositoryId?: unknown };
                const name = typeof parsedBody.name === "string" ? parsedBody.name.trim() : "";
                if (!name) {
                    return new Response(JSON.stringify({ error: "Project name is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const repositoryId =
                    typeof parsedBody.repositoryId === "string"
                        ? parsedBody.repositoryId.trim()
                        : "";
                const result = await service.createProject({ name, repositoryId });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const projectId = req.params.id;
                const result = await service.getProject(projectId);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
            async PUT(req: Server.Request) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                let body: unknown;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const parsedBody = body as { repositoryId?: unknown };
                const rawRepositoryId =
                    typeof parsedBody.repositoryId === "string"
                        ? parsedBody.repositoryId.trim()
                        : null;
                const repositoryId =
                    rawRepositoryId && rawRepositoryId.length > 0 ? rawRepositoryId : null;

                const result = await service.updateProjectRepository({ projectId, repositoryId });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
            async DELETE(req: Server.Request) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = await service.deleteProject(projectId);
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
