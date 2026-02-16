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
const taskIdParamSchema = z.object({ id: z.string().trim().min(1) });
const projectIdParamSchema = z.object({ id: z.string().trim().min(1) });
const projectTasksQuerySchema = z.object({
    isDone: z.enum(["true", "false"]).optional(),
});

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

                const queryInput = Object.fromEntries(new URL(req.url).searchParams.entries());
                const parsedQuery = parseInput({
                    input: queryInput,
                    schema: projectTasksQuerySchema,
                    domain: "tasks",
                    context: "project-tasks:get",
                    errorMessage: "Invalid project task query.",
                });
                if ("response" in parsedQuery) return parsedQuery.response;

                const result = await service.listProjectTaskHistory(parsedParams.data.id, {
                    isDone:
                        parsedQuery.data.isDone === undefined
                            ? undefined
                            : parsedQuery.data.isDone === "true",
                });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
        },
        "/api/tasks/:id/done": {
            async POST(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: taskIdParamSchema,
                    domain: "tasks",
                    context: "tasks:mark-done",
                    errorMessage: "Task id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const result = await service.markTaskHistoryDone(parsedParams.data.id);
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
