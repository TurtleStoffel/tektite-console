import { z } from "zod";
import { jsonHeaders, parseJsonBody } from "../../http/validation";
import { createEditorService } from "./domainApi";

const openVscodeBodySchema = z.object({ path: z.string().trim().min(1) });

export function createEditorRoutes(options: { clonesDir: string }) {
    const service = createEditorService(options);

    return {
        "/api/editor/open-vscode": {
            async POST(req: Request) {
                const parsed = await parseJsonBody({
                    req,
                    schema: openVscodeBodySchema,
                    domain: "editor",
                    context: "editor:open-vscode",
                });
                if ("response" in parsed) return parsed.response;

                const result = await service.openVscode(parsed.data.path);
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
