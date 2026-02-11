import type { Server } from "bun";
import { z } from "zod";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createProductionService } from "./service";

const repositoryUrlBodySchema = z.object({ repositoryUrl: z.string().trim().min(1) });
const repositoryUrlQuerySchema = z.object({ repositoryUrl: z.string().trim().min(1) });

export function createProductionServerRoutes(options: { productionDir: string }) {
    const service = createProductionService({ productionDir: options.productionDir });

    return {
        "/api/production/logs": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const parsedQuery = parseInput({
                    input: { repositoryUrl: url.searchParams.get("repositoryUrl") },
                    schema: repositoryUrlQuerySchema,
                    domain: "production",
                    context: "production:logs",
                    errorMessage: "Repository URL is required.",
                });
                if ("response" in parsedQuery) return parsedQuery.response;

                const result = await service.getLogs(parsedQuery.data.repositoryUrl);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }

                return Response.json(result);
            },
        },

        "/api/production/start": {
            async POST(req: Server.Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: repositoryUrlBodySchema,
                    domain: "production",
                    context: "production:start",
                });
                if ("response" in parsed) return parsed.response;

                const result = await service.start(parsed.data.repositoryUrl);
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
