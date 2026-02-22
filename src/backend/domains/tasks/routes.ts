import { z } from "zod";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { tasksService } from "./service";

type RouteRequest = Request & { params: Record<string, string> };

const createTaskSchema = z.object({
    description: z.string().trim().min(1),
    projectId: z.string().optional().nullable(),
});
const taskIdParamSchema = z.object({ id: z.string().trim().min(1) });
const updateTaskBodySchema = z.object({
    projectId: z.string().trim().min(1).nullable().optional(),
});
const updateTaskCanvasPositionBodySchema = z.object({
    x: z.number().int(),
    y: z.number().int(),
});
const tasksQuerySchema = z.object({
    isDone: z.enum(["true", "false"]).optional(),
    project: z.enum(["assigned", "unassigned"]).optional(),
});
const projectIdParamSchema = z.object({ id: z.string().trim().min(1) });
const projectTasksQuerySchema = z.object({
    isDone: z.enum(["true", "false"]).optional(),
});

export function createTaskRoutes() {
    return {
        "/api/tasks": {
            async GET(req: Request) {
                const queryInput = Object.fromEntries(new URL(req.url).searchParams.entries());
                const parsedQuery = parseInput({
                    input: queryInput,
                    schema: tasksQuerySchema,
                    domain: "tasks",
                    context: "tasks:get",
                    errorMessage: "Invalid tasks query.",
                });
                if ("response" in parsedQuery) return parsedQuery.response;

                const data = await tasksService.listTasks({
                    isDone:
                        parsedQuery.data.isDone === undefined
                            ? undefined
                            : parsedQuery.data.isDone === "true",
                    hasProject:
                        parsedQuery.data.project === undefined
                            ? undefined
                            : parsedQuery.data.project === "assigned",
                });
                return Response.json({ data });
            },
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: createTaskSchema,
                    domain: "tasks",
                    context: "tasks:create",
                });
                if ("response" in parsed) return parsed.response;

                const result = await tasksService.createTask(parsed.data);
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

                const result = await tasksService.listProjectTasks(parsedParams.data.id, {
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

                const result = await tasksService.markTaskDone(parsedParams.data.id);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
        },
        "/api/tasks/:id": {
            async PUT(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: taskIdParamSchema,
                    domain: "tasks",
                    context: "tasks:update",
                    errorMessage: "Task id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const parsedBody = await parseJsonBody({
                    req,
                    schema: updateTaskBodySchema,
                    domain: "tasks",
                    context: "tasks:update",
                });
                if ("response" in parsedBody) return parsedBody.response;

                const result = await tasksService.updateTaskProject({
                    taskId: parsedParams.data.id,
                    projectId: parsedBody.data.projectId ?? null,
                });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
            async DELETE(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: taskIdParamSchema,
                    domain: "tasks",
                    context: "tasks:delete",
                    errorMessage: "Task id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const result = await tasksService.deleteTask(parsedParams.data.id);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
        },
        "/api/tasks/:id/canvas-position": {
            async PUT(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: taskIdParamSchema,
                    domain: "tasks",
                    context: "tasks:update-canvas-position",
                    errorMessage: "Task id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const parsedBody = await parseJsonBody({
                    req,
                    schema: updateTaskCanvasPositionBodySchema,
                    domain: "tasks",
                    context: "tasks:update-canvas-position",
                });
                if ("response" in parsedBody) return parsedBody.response;

                const result = await tasksService.updateTaskCanvasPosition({
                    taskId: parsedParams.data.id,
                    x: parsedBody.data.x,
                    y: parsedBody.data.y,
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
    } as const;
}
