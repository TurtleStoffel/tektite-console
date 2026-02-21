import { z } from "zod";
import { parseJsonBody } from "@/backend/http/validation";
import { createAgentsService } from "./service";

const analyzePayloadSchema = z.object({
    threadPath: z.string().trim().min(1),
});

export function createAgentsRoutes() {
    const service = createAgentsService();

    return {
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
    } as const;
}
