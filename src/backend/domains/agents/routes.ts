import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "@/backend/http/validation";
import { createAgentsService } from "./service";

const executePayloadSchema = z
    .object({
        command: z.string().trim().min(1).optional(),
        prompt: z.string().trim().min(1).optional(),
        projectId: z.string().trim().min(1).optional().nullable(),
        repository: z.object({ url: z.string().trim().min(1) }),
    })
    .refine((value) => Boolean(value.command ?? value.prompt), {
        message: "Command text is required.",
        path: ["command"],
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

const worktreeThreadMetadataPayloadSchema = z.object({
    worktreePaths: z.array(z.string().trim().min(1)),
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

                const basePrompt = parsed.data.command ?? parsed.data.prompt;
                if (!basePrompt) {
                    throw new Error("Command text is required.");
                }
                const repositoryUrl = parsed.data.repository.url;
                const result = await service.executeWithTaskHistory({
                    prompt: basePrompt,
                    projectId: parsed.data.projectId,
                    repositoryUrl,
                });
                if ("error" in result && "status" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                if (result.error) {
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status: 500,
                    });
                }

                return result.value;
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
                console.info("[execute] received thread follow-up comment; skipping task history", {
                    worktreePath: parsed.data.worktreePath,
                    threadId: parsed.data.threadId,
                    projectId: parsed.data.projectId ?? null,
                });

                const result = service.executeThreadComment({
                    comment: parsed.data.comment,
                    workingDirectory: parsed.data.worktreePath,
                    threadId: parsed.data.threadId,
                });
                if (result.error) {
                    return new Response(JSON.stringify({ error: result.error.message }), {
                        status: 500,
                    });
                }

                return result.value;
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
        "/api/agents/worktree-thread-metadata": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: worktreeThreadMetadataPayloadSchema,
                    domain: "agents",
                    context: "thread-metadata:list",
                });
                if ("response" in parsed) return parsed.response;

                const data = service.getWorktreeThreadMetadata({
                    worktreePaths: parsed.data.worktreePaths,
                });
                return new Response(JSON.stringify({ data }), {
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
