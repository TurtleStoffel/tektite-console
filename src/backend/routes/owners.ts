import type { Database } from "bun:sqlite";
import type { Server } from "bun";
import { randomUUID } from "node:crypto";

export function createOwnerRoutes(options: { db: Database }) {
    const { db } = options;

    return {
        "/api/owners": {
            async GET() {
                const owners = db
                    .query(
                        `
                        SELECT
                            o.id AS id,
                            o.owner_type AS owner_type,
                            p.name AS project_name,
                            i.description AS idea_description
                        FROM owners o
                        LEFT JOIN projects p ON p.owner_id = o.id
                        LEFT JOIN ideas i ON i.owner_id = o.id
                        ORDER BY o.owner_type ASC
                        `,
                    )
                    .all() as Array<{
                    id: string;
                    owner_type: "project" | "idea";
                    project_name: string | null;
                    idea_description: string | null;
                }>;

                const normalized = owners.map((owner) => ({
                    id: owner.id,
                    ownerType: owner.owner_type,
                    name: owner.owner_type === "project" ? owner.project_name : null,
                    description: owner.owner_type === "idea" ? owner.idea_description : null,
                }));

                return Response.json({ owners: normalized });
            },
        },

        "/api/projects": {
            async POST(req: Server.Request) {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const name = typeof body?.name === "string" ? body.name.trim() : "";
                if (!name) {
                    return new Response(JSON.stringify({ error: "Project name is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const ownerId = randomUUID();
                const projectId = randomUUID();
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'project')").run(ownerId);
                db.query("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(projectId, ownerId, name);
                return Response.json({ id: ownerId, ownerType: "project", name });
            },
        },

        "/api/ideas": {
            async POST(req: Server.Request) {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const description = typeof body?.description === "string" ? body.description.trim() : "";
                if (!description) {
                    return new Response(JSON.stringify({ error: "Idea description is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const ownerId = randomUUID();
                const ideaId = randomUUID();
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'idea')").run(ownerId);
                db.query("INSERT INTO ideas (id, owner_id, description) VALUES (?, ?, ?)").run(
                    ideaId,
                    ownerId,
                    description,
                );
                return Response.json({ id: ownerId, ownerType: "idea", description });
            },
        },
    } as const;
}

