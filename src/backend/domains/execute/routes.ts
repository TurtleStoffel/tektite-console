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
        comment: z.string().trim().min(1).optional(),
        worktreePath: z.string().trim().min(1).optional(),
        threadId: z.string().trim().min(1).optional(),
        projectId: z.string().trim().min(1).optional().nullable(),
        repository: z.object({ url: z.string().trim().min(1) }).optional(),
    })
    .superRefine((value, ctx) => {
        const hasPrompt = Boolean(value.command ?? value.prompt);
        const hasComment = Boolean(value.comment);

        if (hasPrompt === hasComment) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "Provide either command/prompt+repository or comment+worktreePath+threadId.",
                path: ["command"],
            });
            return;
        }

        if (hasPrompt && !value.repository?.url) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Repository URL is required when executing a prompt.",
                path: ["repository", "url"],
            });
        }

        if (hasComment && (!value.worktreePath || !value.threadId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "worktreePath and threadId are required when posting a comment.",
                path: ["worktreePath"],
            });
        }
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

                const basePrompt = parsed.data.command ?? parsed.data.prompt ?? parsed.data.comment;
                if (!basePrompt) {
                    throw new Error("Prompt text is required.");
                }
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

                const result = parsed.data.comment
                    ? service.executeThreadComment({
                          comment: parsed.data.comment,
                          workingDirectory: parsed.data.worktreePath as string,
                          threadId: parsed.data.threadId as string,
                      })
                    : await service.execute({
                          prompt: basePrompt,
                          repositoryUrl: parsed.data.repository?.url as string,
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
