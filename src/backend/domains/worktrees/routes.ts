import type { Server } from "bun";
import { z } from "zod";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createWorktreesService } from "./service";

const worktreePathBodySchema = z.object({ path: z.string().trim().min(1) });
const worktreePathQuerySchema = z.object({ path: z.string().trim().min(1) });

export function createDevServerRoutes(options: { clonesDir: string; productionDir: string }) {
    const service = createWorktreesService({
        clonesDir: options.clonesDir,
        productionDir: options.productionDir,
    });

    return {
        "/api/worktrees/dev-terminal/start": {
            async POST(req: Server.Request) {
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

        "/api/worktrees/dev-terminal": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const parsedQuery = parseInput({
                    input: { path: url.searchParams.get("path") },
                    schema: worktreePathQuerySchema,
                    domain: "worktrees",
                    context: "worktrees:dev-terminal:get",
                    errorMessage: "Worktree path is required.",
                });
                if ("response" in parsedQuery) return parsedQuery.response;

                const result = service.getDevTerminal(parsedQuery.data.path);
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
