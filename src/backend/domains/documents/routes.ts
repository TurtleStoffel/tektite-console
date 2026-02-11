import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type * as schema from "../../db/local/schema";
import { jsonHeaders, parseInput, parseJsonBody } from "../../http/validation";
import { createDocumentsService } from "./service";

type RouteRequest = Request & { params: Record<string, string> };
type Db = BunSQLiteDatabase<typeof schema>;

const createDocumentSchema = z.object({
    markdown: z.string(),
    projectId: z.string().optional().nullable(),
});
const createProjectDocumentSchema = z.object({ markdown: z.string() });
const updateDocumentSchema = z.object({
    markdown: z.string(),
    projectId: z.string().optional().nullable(),
});
const requiredProjectIdParamSchema = z.object({ id: z.string().trim().min(1) });
const requiredDocumentIdParamSchema = z.object({ id: z.string().trim().min(1) });

export function createDocumentRoutes(options: { db: Db }) {
    const service = createDocumentsService({ db: options.db });

    return {
        "/api/documents": {
            async GET() {
                const data = await service.listDocuments();
                return Response.json({ data });
            },
            async POST(req: RouteRequest) {
                const parsed = await parseJsonBody({
                    req,
                    schema: createDocumentSchema,
                    domain: "documents",
                    context: "documents:create",
                });
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
                const parsedParams = parseInput({
                    input: req.params,
                    schema: requiredProjectIdParamSchema,
                    domain: "documents",
                    context: "project-documents:get",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const projectId = parsedParams.data.id;
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
                const parsedParams = parseInput({
                    input: req.params,
                    schema: requiredProjectIdParamSchema,
                    domain: "documents",
                    context: "project-documents:create",
                    errorMessage: "Project id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const projectId = parsedParams.data.id;

                const parsed = await parseJsonBody({
                    req,
                    schema: createProjectDocumentSchema,
                    domain: "documents",
                    context: "project-documents:create",
                });
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
                const parsedParams = parseInput({
                    input: req.params,
                    schema: requiredDocumentIdParamSchema,
                    domain: "documents",
                    context: "documents:get",
                    errorMessage: "Document id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const documentId = parsedParams.data.id;
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
                const parsedParams = parseInput({
                    input: req.params,
                    schema: requiredDocumentIdParamSchema,
                    domain: "documents",
                    context: "documents:update",
                    errorMessage: "Document id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const documentId = parsedParams.data.id;
                const parsed = await parseJsonBody({
                    req,
                    schema: updateDocumentSchema,
                    domain: "documents",
                    context: "documents:update",
                });
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
                const parsedParams = parseInput({
                    input: req.params,
                    schema: requiredDocumentIdParamSchema,
                    domain: "documents",
                    context: "documents:delete",
                    errorMessage: "Document id is required.",
                });
                if ("response" in parsedParams) return parsedParams.response;

                const documentId = parsedParams.data.id;
                return Response.json(await service.deleteDocument(documentId));
            },
        },
    } as const;
}
