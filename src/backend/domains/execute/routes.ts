import { z } from "zod";
import { parseJsonBody } from "../../http/validation";
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

                const result = await service.execute({ prompt: basePrompt, repositoryUrl });
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
