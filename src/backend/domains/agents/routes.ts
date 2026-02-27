import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "@/backend/http/validation";
import { createAgentsService } from "./domainApi";

const executePayloadSchema = z.object({
    taskId: z.string().trim().min(1),
});

const resumePayloadSchema = z.object({
    comment: z.string().trim().min(1),
    worktreePath: z.string().trim().min(1),
    threadId: z.string().trim().min(1),
    projectId: z.string().trim().min(1).optional().nullable(),
});

const analyzePayloadSchema = z.object({
    threadPath: z.string().trim().min(1),
});

export function createAgentsRoutes(options: { clonesDir: string }) {
    const service = createAgentsService({ clonesDir: options.clonesDir });

    return {
        "/api/execute": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: executePayloadSchema,
                    domain: "agents",
                    context: "execute:create",
                });
                if ("response" in parsed) return parsed.response;

                const result = await service.executeByTaskId({
                    taskId: parsed.data.taskId,
                });
                if (!result.ok) {
                    const status =
                        result.error.type === "task-not-found"
                            ? 404
                            : result.error.type === "project-not-found"
                              ? 404
                              : result.error.type === "task-project-missing" ||
                                  result.error.type === "project-repository-missing"
                                ? 400
                                : 500;
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status,
                        headers: jsonHeaders,
                    });
                }

                return new Response(JSON.stringify({ data: result.value }), {
                    status: 202,
                    headers: jsonHeaders,
                });
            },
        },
        "/api/resume": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: resumePayloadSchema,
                    domain: "agents",
                    context: "execute:resume",
                });
                if ("response" in parsed) return parsed.response;
                console.info("[execute] received thread follow-up comment; skipping tasks", {
                    worktreePath: parsed.data.worktreePath,
                    threadId: parsed.data.threadId,
                    projectId: parsed.data.projectId ?? null,
                });

                const result = service.executeThreadComment({
                    comment: parsed.data.comment,
                    workingDirectory: parsed.data.worktreePath,
                    threadId: parsed.data.threadId,
                    projectId: parsed.data.projectId ?? null,
                });
                if (result.error) {
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status: 500,
                        headers: jsonHeaders,
                    });
                }

                return new Response(JSON.stringify({ data: result.value }), {
                    status: 202,
                    headers: jsonHeaders,
                });
            },
        },
        "/api/agent-runs": {
            async GET(req: Request) {
                const url = new URL(req.url);
                const projectIdParam = url.searchParams.get("projectId");
                const projectId = projectIdParam?.trim() ? projectIdParam : null;
                const data = service.listAgentRuns({ projectId });

                return new Response(JSON.stringify({ data }), {
                    status: 200,
                    headers: jsonHeaders,
                });
            },
        },
        "/api/worktrees/status": {
            async GET(req: Request) {
                const url = new URL(req.url);
                const projectIdParam = url.searchParams.get("projectId");
                const projectId = projectIdParam?.trim() ? projectIdParam : null;
                const data = service.listActiveWorktreeStatuses({ projectId });

                return new Response(JSON.stringify({ data }), {
                    status: 200,
                    headers: jsonHeaders,
                });
            },
        },
        "/api/codex-threads": {
            async GET() {
                const result = await service.listThreads();
                if (!result.ok) {
                    const status = result.error.type === "codex-home-missing" ? 500 : 400;
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status,
                    });
                }

                return new Response(JSON.stringify({ data: result.value }), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store",
                    },
                });
            },
        },
        "/api/codex-threads/analyze": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: analyzePayloadSchema,
                    domain: "codex-threads",
                    context: "analyze",
                });
                if ("response" in parsed) {
                    return parsed.response;
                }

                const result = await service.analyzeThread({
                    threadPath: parsed.data.threadPath,
                });
                if (!result.ok) {
                    const status = result.error.type === "analysis-failed" ? 500 : 400;
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status,
                    });
                }

                return new Response(JSON.stringify({ data: result.value }), {
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
