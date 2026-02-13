import type { Server } from "bun";
import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "../../http/validation";
import { createProductionService } from "./service";

const repositoryUrlBodySchema = z.object({ repositoryUrl: z.string().trim().min(1) });

export function createProductionServerRoutes(options: { productionDir: string }) {
    const service = createProductionService({ productionDir: options.productionDir });

    return {
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
