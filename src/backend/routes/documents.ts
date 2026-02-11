import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { asc, eq } from "drizzle-orm";
import type * as schema from "../db/local/schema";
import { documents, projects } from "../db/local/schema";

type RouteRequest = Request & { params: Record<string, string> };

const jsonHeaders = { "Content-Type": "application/json" };

const createDocumentSchema = z.object({
    markdown: z.string(),
    projectId: z.string().optional().nullable(),
});

const createProjectDocumentSchema = z.object({
    markdown: z.string(),
});

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
        console.warn("[documents] invalid request body", {
            context,
            issues: parsed.error.issues,
        });
        return {
            response: new Response(
                JSON.stringify({ error: "Invalid request payload.", issues: parsed.error.issues }),
                {
                    status: 400,
                    headers: jsonHeaders,
                },
            ),
        };
    }

    return { data: parsed.data };
}

type Db = BunSQLiteDatabase<typeof schema>;

async function findProject(db: Db, projectId: string) {
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function createDocumentRoutes(options: { db: Db }) {
    const { db } = options;

    return {
        "/api/documents": {
            async GET() {
                const rows = await db
                    .select({
                        id: documents.id,
                        projectId: documents.projectId,
                        markdown: documents.markdown,
                        projectName: projects.name,
                    })
                    .from(documents)
                    .leftJoin(projects, eq(documents.projectId, projects.id))
                    .orderBy(asc(projects.name), asc(documents.id))
                    .execute();

                const result = rows.map((row) => ({
                    id: row.id,
                    projectId: row.projectId,
                    projectName: row.projectName,
                    markdown: row.markdown,
                }));

                return Response.json({ data: result });
            },
            async POST(req: RouteRequest) {
                const parsed = await parseJsonBody(req, createDocumentSchema, "documents:create");
                if ("response" in parsed) {
                    return parsed.response;
                }
                const body = parsed.data;
                const rawProjectId =
                    typeof body?.projectId === "string" ? body.projectId.trim() : "";
                const projectId = rawProjectId.length > 0 ? rawProjectId : null;
                if (projectId) {
                    const project = await findProject(db, projectId);
                    if (!project) {
                        return new Response(JSON.stringify({ error: "Project not found." }), {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                }

                const documentId = randomUUID();
                await db.insert(documents)
                    .values({
                        id: documentId,
                        projectId,
                        markdown: body.markdown,
                    })
                    .execute();
                console.info("[documents] created", { documentId, projectId });

                return Response.json({ id: documentId, projectId, markdown: body.markdown });
            },
        },
        "/api/projects/:id/documents": {
            async GET(req: RouteRequest) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                const project = await findProject(db, projectId);
                if (!project) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const rows = await db
                    .select({
                        id: documents.id,
                        projectId: documents.projectId,
                        markdown: documents.markdown,
                    })
                    .from(documents)
                    .where(eq(documents.projectId, projectId))
                    .orderBy(asc(documents.id))
                    .execute();

                const result = rows.map((row) => ({
                    id: row.id,
                    projectId: row.projectId,
                    markdown: row.markdown,
                }));

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
                const project = await findProject(db, projectId);
                if (!project) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: jsonHeaders,
                    });
                }

                const parsed = await parseJsonBody(
                    req,
                    createProjectDocumentSchema,
                    "project-documents:create",
                );
                if ("response" in parsed) {
                    return parsed.response;
                }
                const body = parsed.data;

                const documentId = randomUUID();
                await db.insert(documents)
                    .values({
                        id: documentId,
                        projectId,
                        markdown: body.markdown,
                    })
                    .execute();
                console.info("[documents] created", { documentId, projectId });

                return Response.json({ id: documentId, projectId, markdown: body.markdown });
            },
        },
        "/api/documents/:id": {
            async GET(req: RouteRequest) {
                const documentId = req.params.id ?? null;
                if (!documentId) {
                    return new Response(JSON.stringify({ error: "Document id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                const row = await db
                    .select({
                        id: documents.id,
                        projectId: documents.projectId,
                        markdown: documents.markdown,
                    })
                    .from(documents)
                    .where(eq(documents.id, documentId))
                    .execute();

                const document = row[0] ?? null;
                if (!document) {
                    return new Response(JSON.stringify({ error: "Document not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json({
                    id: document.id,
                    projectId: document.projectId,
                    markdown: document.markdown,
                });
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
                if ("response" in parsed) {
                    return parsed.response;
                }
                const body = parsed.data;

                const rawProjectId =
                    typeof body?.projectId === "string" ? body.projectId.trim() : "";
                const projectId = rawProjectId.length > 0 ? rawProjectId : null;
                if (projectId) {
                    const project = await findProject(db, projectId);
                    if (!project) {
                        return new Response(JSON.stringify({ error: "Project not found." }), {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                }

                await db.update(documents)
                    .set({ markdown: body.markdown, projectId })
                    .where(eq(documents.id, documentId))
                    .execute();

                const row = await db
                    .select({
                        id: documents.id,
                        projectId: documents.projectId,
                        markdown: documents.markdown,
                    })
                    .from(documents)
                    .where(eq(documents.id, documentId))
                    .execute();
                console.info("[documents] updated", { documentId });

                const document = row[0] ?? null;
                return Response.json({
                    id: document?.id ?? documentId,
                    projectId: document?.projectId ?? projectId,
                    markdown: document?.markdown ?? body.markdown,
                });
            },
            async DELETE(req: RouteRequest) {
                const documentId = req.params.id ?? null;
                if (!documentId) {
                    return new Response(JSON.stringify({ error: "Document id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                await db.delete(documents).where(eq(documents.id, documentId)).execute();

                console.info("[documents] deleted", { documentId });
                return Response.json({ id: documentId });
            },
        },
    } as const;
}
