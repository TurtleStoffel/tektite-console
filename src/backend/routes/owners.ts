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
                            p.url AS project_url,
                            i.description AS idea_description
                        FROM owners o
                        LEFT JOIN projects p ON p.id = o.id
                        LEFT JOIN ideas i ON i.id = o.id
                        ORDER BY o.owner_type ASC
                        `,
                    )
                    .all() as Array<{
                    id: string;
                    owner_type: "project" | "idea";
                    project_name: string | null;
                    project_url: string | null;
                    idea_description: string | null;
                }>;

                const normalized = owners.map((owner) => ({
                    id: owner.id,
                    ownerType: owner.owner_type,
                    name: owner.owner_type === "project" ? owner.project_name : null,
                    url: owner.owner_type === "project" ? owner.project_url : null,
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

                const url = typeof body?.url === "string" ? body.url.trim() : "";
                if (!url) {
                    return new Response(JSON.stringify({ error: "Project URL is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                try {
                    const parsed = new URL(url);
                    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                        throw new Error("Invalid protocol.");
                    }
                } catch {
                    return new Response(JSON.stringify({ error: "Project URL must be a valid http(s) URL." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const ownerId = randomUUID();
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'project')").run(ownerId);
                db.query("INSERT INTO projects (id, name, url) VALUES (?, ?, ?)").run(ownerId, name, url);
                return Response.json({ id: ownerId, ownerType: "project", name, url });
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
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'idea')").run(ownerId);
                db.query("INSERT INTO ideas (id, description) VALUES (?, ?)").run(ownerId, description);
                return Response.json({ id: ownerId, ownerType: "idea", description });
            },
        },
    } as const;
}
