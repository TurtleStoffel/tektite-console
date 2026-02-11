import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type * as schema from "../../db/local/schema";
import { createDocumentsService } from "./service";

type RouteRequest = Request & { params: Record<string, string> };
type Db = BunSQLiteDatabase<typeof schema>;

const jsonHeaders = { "Content-Type": "application/json" };

const createDocumentSchema = z.object({
    markdown: z.string(),
    projectId: z.string().optional().nullable(),
});
const createProjectDocumentSchema = z.object({ markdown: z.string() });
const updateDocumentSchema = z.object({
    markdown: z.string(),
    projectId: z.string().optional().nullable(),
});

async function parseJsonBody<T extends z.ZodTypeAny>(
    req: Request,
    schema: T,
    context: string,
): Promise<{ data: z.infer<T> } | { response: Response }> {
    let body: unknown;
    try {
        body = await req.json();
    } catch (error) {
        console.warn("[documents] invalid json payload", { context, error });
        return {
            response: new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                status: 400,
                headers: jsonHeaders,
            }),
        };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        console.warn("[documents] invalid request body", { context, issues: parsed.error.issues });
        return {
            response: new Response(
                JSON.stringify({ error: "Invalid request payload.", issues: parsed.error.issues }),
                { status: 400, headers: jsonHeaders },
            ),
        };
    }
    return { data: parsed.data };
}

export function createDocumentRoutes(options: { db: Db }) {
    const service = createDocumentsService({ db: options.db });

    return {
        "/api/documents": {
            async GET() {
                const data = await service.listDocuments();
                return Response.json({ data });
            },
            async POST(req: RouteRequest) {
                const parsed = await parseJsonBody(req, createDocumentSchema, "documents:create");
                if ("response" in parsed) return parsed.response;

                const result = await service.createDocument(parsed.data);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(result);
            },
        },
        "/api/projects/:id/documents": {
            async GET(req: RouteRequest) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }
                const result = await service.listProjectDocuments(projectId);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json({ data: result });
            },
            async POST(req: RouteRequest) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }

                const parsed = await parseJsonBody(
                    req,
                    createProjectDocumentSchema,
                    "project-documents:create",
                );
                if ("response" in parsed) return parsed.response;

                const result = await service.createProjectDocument({
                    projectId,
                    markdown: parsed.data.markdown,
                });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(result);
            },
        },
        "/api/documents/:id": {
            async GET(req: RouteRequest) {
                const documentId = req.params.id ?? null;
                if (!documentId) {
                    return new Response(JSON.stringify({ error: "Document id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }
                const result = await service.getDocument(documentId);
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(result);
            },
            async PUT(req: RouteRequest) {
                const documentId = req.params.id ?? null;
                if (!documentId) {
                    return new Response(JSON.stringify({ error: "Document id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }
                const parsed = await parseJsonBody(req, updateDocumentSchema, "documents:update");
                if ("response" in parsed) return parsed.response;

                const result = await service.updateDocument({
                    documentId,
                    markdown: parsed.data.markdown,
                    projectId: parsed.data.projectId,
                });
                if ("error" in result) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: result.status,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(result);
            },
            async DELETE(req: RouteRequest) {
                const documentId = req.params.id ?? null;
                if (!documentId) {
                    return new Response(JSON.stringify({ error: "Document id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }
                return Response.json(await service.deleteDocument(documentId));
            },
        },
    } as const;
}
