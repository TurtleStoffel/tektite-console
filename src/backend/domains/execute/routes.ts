import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import { createTasksService } from "@/backend/domains/tasks/service";
import type * as schema from "../../db/local/schema";
import { jsonHeaders, parseJsonBody } from "../../http/validation";
import { createExecuteService } from "./service";

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

export function createExecuteRoutes(options: {
    clonesDir: string;
    db: BunSQLiteDatabase<typeof schema>;
}) {
    const service = createExecuteService({ clonesDir: options.clonesDir });
    const tasksService = createTasksService({ db: options.db });

    return {
        "/api/execute": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: executePayloadSchema,
                    domain: "execute",
                    context: "execute:create",
                });
                if ("response" in parsed) return parsed.response;

                const basePrompt = parsed.data.command ?? parsed.data.prompt;
                if (!basePrompt) {
                    throw new Error("Command text is required.");
                }
                const repositoryUrl = parsed.data.repository.url;
                const createTaskResult = await tasksService.createTaskHistory({
                    prompt: basePrompt,
                    projectId: parsed.data.projectId,
                });
                if ("error" in createTaskResult) {
                    return new Response(JSON.stringify({ error: createTaskResult.error }), {
                        status: createTaskResult.status,
                        headers: jsonHeaders,
                    });
                }

                const result = await service.execute({ prompt: basePrompt, repositoryUrl });
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
                    domain: "execute",
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
    } as const;
}
