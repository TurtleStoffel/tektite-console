import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type RouteRequest = Request & { params: Record<string, string> };

type DocumentRow = {
    id: string;
    project_id: string | null;
    markdown: string;
};

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

function findProject(db: Database, projectId: string) {
    return db.query("SELECT id FROM projects WHERE id = ?").get(projectId) as
        | { id: string }
        | null
        | undefined;
}

export function createDocumentRoutes(options: { db: Database }) {
    const { db } = options;

    return {
        "/api/documents": {
            async GET() {
                const rows = db
                    .query(
                        `
                        SELECT d.id, d.project_id, d.markdown, p.name AS project_name
                        FROM documents d
                        LEFT JOIN projects p ON p.id = d.project_id
                        ORDER BY p.name ASC, d.id ASC
                        `,
                    )
                    .all() as Array<DocumentRow & { project_name: string | null }>;

                const documents = rows.map((row) => ({
                    id: row.id,
                    projectId: row.project_id,
                    projectName: row.project_name,
                    markdown: row.markdown,
                }));

                return Response.json({ documents });
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
                    const project = findProject(db, projectId);
                    if (!project) {
                        return new Response(JSON.stringify({ error: "Project not found." }), {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                }

                const documentId = randomUUID();
                db.query("INSERT INTO documents (id, project_id, markdown) VALUES (?, ?, ?)").run(
                    documentId,
                    projectId,
                    body.markdown,
                );
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
                const project = findProject(db, projectId);
                if (!project) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const rows = db
                    .query(
                        `
                        SELECT id, project_id, markdown
                        FROM documents
                        WHERE project_id = ?
                        ORDER BY id ASC
                        `,
                    )
                    .all(projectId) as DocumentRow[];

                const documents = rows.map((row) => ({
                    id: row.id,
                    projectId: row.project_id,
                    markdown: row.markdown,
                }));

                return Response.json({ documents });
            },
            async POST(req: RouteRequest) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: jsonHeaders,
                    });
                }
                const project = findProject(db, projectId);
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
                db.query("INSERT INTO documents (id, project_id, markdown) VALUES (?, ?, ?)").run(
                    documentId,
                    projectId,
                    body.markdown,
                );
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
                const row = db
                    .query("SELECT id, project_id, markdown FROM documents WHERE id = ?")
                    .get(documentId) as DocumentRow | null | undefined;

                if (!row) {
                    return new Response(JSON.stringify({ error: "Document not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json({
                    id: row.id,
                    projectId: row.project_id,
                    markdown: row.markdown,
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
                    const project = findProject(db, projectId);
                    if (!project) {
                        return new Response(JSON.stringify({ error: "Project not found." }), {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                }

                const result = db
                    .query("UPDATE documents SET markdown = ?, project_id = ? WHERE id = ?")
                    .run(body.markdown, projectId, documentId) as { changes: number };

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: "Document not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const row = db
                    .query("SELECT id, project_id, markdown FROM documents WHERE id = ?")
                    .get(documentId) as DocumentRow | null | undefined;
                console.info("[documents] updated", { documentId });

                return Response.json({
                    id: row?.id ?? documentId,
                    projectId: row?.project_id ?? projectId,
                    markdown: row?.markdown ?? body.markdown,
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
                const result = db.query("DELETE FROM documents WHERE id = ?").run(documentId) as {
                    changes: number;
                };

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: "Document not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                console.info("[documents] deleted", { documentId });
                return Response.json({ id: documentId });
            },
        },
    } as const;
}
