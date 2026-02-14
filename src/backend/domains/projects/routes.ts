import type { Server } from "bun";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type * as schema from "../../db/local/schema";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createProjectsService } from "./service";

const createProjectBodySchema = z.object({
    name: z.string().trim().min(1),
    repositoryId: z.string().optional(),
});
const updateProjectRepositoryBodySchema = z.object({
    repositoryId: z.string().trim().min(1).nullable().optional(),
});
const projectIdParamSchema = z.object({ id: z.string().trim().min(1) });

export function createProjectRoutes(options: {
    db: BunSQLiteDatabase<typeof schema>;
    clonesDir: string;
}) {
    const service = createProjectsService({
        db: options.db,
        clonesDir: options.clonesDir,
    });

    return {
        "/api/projects": {
            async GET() {
                const data = await service.listProjects();
                return Response.json({ data });
            },
            async POST(req: Server.Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: createProjectBodySchema,
                    domain: "projects",
                    context: "projects:create",
                });
                if ("response" in parsed) return parsed.response;

                const name = parsed.data.name;
                const repositoryId = parsed.data.repositoryId?.trim() ?? "";
                const result = await service.createProject({ name, repositoryId });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }

                return Response.json(result);
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: projectIdParamSchema,
                    domain: "projects",
                    context: "projects:get",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const projectId = parsedParams.data.id;
                const result = await service.getProject(projectId);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }

                return Response.json(result);
            },
            async PUT(req: Server.Request) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: projectIdParamSchema,
                    domain: "projects",
                    context: "projects:update",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;
                const projectId = parsedParams.data.id;

                const parsedBody = await parseJsonBody({
                    req,
                    schema: updateProjectRepositoryBodySchema,
                    domain: "projects",
                    context: "projects:update",
                });
                if ("response" in parsedBody) return parsedBody.response;

                const repositoryId = parsedBody.data.repositoryId ?? null;

                const result = await service.updateProjectRepository({ projectId, repositoryId });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }

                return Response.json(result);
            },
            async DELETE(req: Server.Request) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: projectIdParamSchema,
                    domain: "projects",
                    context: "projects:delete",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;
                const projectId = parsedParams.data.id;

                const result = await service.deleteProject(projectId);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }

                return Response.json(result);
            },
        },
    } as const;
}
