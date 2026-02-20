import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type * as schema from "../../db/local/schema";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createFeatureFlagsService } from "./service";

type Db = BunSQLiteDatabase<typeof schema>;

const upsertFeatureFlagSchema = z.object({
    key: z.string().trim().min(1),
    description: z.string().trim().min(1),
    isEnabled: z.boolean(),
});

const featureFlagKeyParamSchema = z.object({
    key: z.string().trim().min(1),
});

type RouteRequest = Request & { params: Record<string, string | undefined> };

export function createFeatureFlagRoutes(options: { db: Db }) {
    const service = createFeatureFlagsService({ db: options.db });

    return {
        "/api/feature-flags": {
            async GET() {
                const data = await service.listFeatureFlags();
                return Response.json({ data });
            },
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: upsertFeatureFlagSchema,
                    domain: "feature-flags",
                    context: "feature-flags:upsert",
                });
                if ("response" in parsed) return parsed.response;

                const data = await service.upsertFeatureFlag(parsed.data);
                return Response.json({ data });
            },
        },
        "/api/feature-flags/:key": {
            async PUT(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: featureFlagKeyParamSchema,
                    domain: "feature-flags",
                    context: "feature-flags:update",
                    errorMessage: "Feature flag key is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const parsedBody = await parseJsonBody({
                    req,
                    schema: upsertFeatureFlagSchema.omit({ key: true }),
                    domain: "feature-flags",
                    context: "feature-flags:update",
                });
                if ("response" in parsedBody) return parsedBody.response;

                const data = await service.upsertFeatureFlag({
                    key: parsedParams.data.key,
                    description: parsedBody.data.description,
                    isEnabled: parsedBody.data.isEnabled,
                });
                return Response.json({ data });
            },
        },
        "/api/feature-flags/:key/toggle": {
            async POST(req: RouteRequest) {
                const parsedParams = parseInput({
                    input: req.params,
                    schema: featureFlagKeyParamSchema,
                    domain: "feature-flags",
                    context: "feature-flags:toggle",
                    errorMessage: "Feature flag key is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const flags = await service.listFeatureFlags();
                const existing = flags.find((flag) => flag.key === parsedParams.data.key);
                if (!existing) {
                    return new Response(JSON.stringify({ error: "Feature flag not found." }), {
                        status: 404,
                        headers: jsonHeaders,
                    });
                }

                const data = await service.upsertFeatureFlag({
                    key: existing.key,
                    description: existing.description,
                    isEnabled: !existing.isEnabled,
                });
                return Response.json({ data });
            },
        },
    } as const;
}
