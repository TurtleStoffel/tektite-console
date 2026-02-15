import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type * as schema from "../../db/local/schema";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createTasksService } from "./service";

type RouteRequest = Request & { params: Record<string, string> };
type Db = BunSQLiteDatabase<typeof schema>;

const createTaskHistorySchema = z.object({
    prompt: z.string().trim().min(1),
    projectId: z.string().optional().nullable(),
});
const projectIdParamSchema = z.object({ id: z.string().trim().min(1) });

export function createTaskRoutes(options: { db: Db }) {
    const service = createTasksService({ db: options.db });

    return {
        "/api/tasks": {
            async GET() {
                const data = await service.listTaskHistory();
                return Response.json({ data });
            },
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: createTaskHistorySchema,
                    domain: "tasks",
                    context: "tasks:create",
                });
                if ("response" in parsed) return parsed.response;

                const result = await service.createTaskHistory(parsed.data);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(result);
            },
        },
        "/api/projects/:id/tasks": {
            async GET(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: projectIdParamSchema,
                    domain: "tasks",
                    context: "project-tasks:get",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const result = await service.listProjectTaskHistory(parsedParams.data.id);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
        },
    } as const;
}
