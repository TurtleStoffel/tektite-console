import type { Server } from "bun";
import { createEditorService } from "./service";

export function createEditorRoutes(options: { clonesDir: string; productionDir: string }) {
    const service = createEditorService(options);

    return {
        "/api/editor/open-vscode": {
            async POST(req: Server.Request) {
                let body: unknown;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const parsedBody = body as { path?: unknown };
                const rawPath = typeof parsedBody.path === "string" ? parsedBody.path.trim() : "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Folder path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = await service.openVscode(rawPath);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json(result);
            },
        },
    } as const;
}
