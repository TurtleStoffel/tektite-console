import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "../../http/validation";
import { createWorktreesService } from "./service";

const worktreePathBodySchema = z.object({ path: z.string().trim().min(1) });

export function createDevServerRoutes(options: { clonesDir: string }) {
    const service = createWorktreesService({ clonesDir: options.clonesDir });

    return {
        "/api/worktrees/dev-terminal/start": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: worktreePathBodySchema,
                    domain: "worktrees",
                    context: "worktrees:dev-terminal:start",
                });
                if ("response" in parsed) return parsed.response;

                const result = service.startDevTerminal(parsed.data.path);
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
