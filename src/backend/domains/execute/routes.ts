import type { Server } from "bun";
import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "../../http/validation";
import { createExecuteService } from "./service";

const executePayloadSchema = z
    .object({
        command: z.string().trim().min(1).optional(),
        prompt: z.string().trim().min(1).optional(),
        repository: z.object({ url: z.string().trim().min(1) }),
    })
    .refine((value) => Boolean(value.command ?? value.prompt), {
        message: "Command text is required.",
        path: ["command"],
    });

export function createExecuteRoutes(options: { clonesDir: string }) {
    const service = createExecuteService({ clonesDir: options.clonesDir });

    return {
        "/api/execute": {
            async POST(req: Server.Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: executePayloadSchema,
                    domain: "execute",
                    context: "execute:create",
                });
                if ("response" in parsed) return parsed.response;

                const basePrompt = parsed.data.command ?? parsed.data.prompt;
                const repositoryUrl = parsed.data.repository.url;

                try {
                    return await service.execute({ prompt: basePrompt, repositoryUrl });
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Failed to prepare repository for execution.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: jsonHeaders,
                    });
                }
            },
        },
    } as const;
}
