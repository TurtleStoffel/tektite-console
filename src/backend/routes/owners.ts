import type { Database } from "bun:sqlite";
import type { Server } from "bun";
import { randomUUID } from "node:crypto";
import { findRepositoryClones } from "../cloneDiscovery";
import { getProductionCloneInfo } from "../productionClone";
import { getRemoteBranchUpdateStatus } from "../remoteUpdates";
import { getConsoleRepositoryUrl } from "../consoleRepository";

export function createOwnerRoutes(options: {
    db: Database;
    clonesDir: string;
    productionDir: string;
}) {
    const { db, clonesDir, productionDir } = options;

    const consoleRepositoryUrl = getConsoleRepositoryUrl();

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
                    return new Response(
                        JSON.stringify({ error: "Project URL must be a valid http(s) URL." }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const ownerId = randomUUID();
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'project')").run(ownerId);
                db.query("INSERT INTO projects (id, name, url) VALUES (?, ?, ?)").run(
                    ownerId,
                    name,
                    url,
                );
                return Response.json({ id: ownerId, ownerType: "project", name, url });
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const ownerId = req.params.id;
                const row = db
                    .query(
                        `
                        SELECT
                            o.id AS id,
                            p.name AS name,
                            p.url AS url
                        FROM owners o
                        JOIN projects p ON p.id = o.id
                        WHERE o.id = ? AND o.owner_type = 'project'
                        `,
                    )
                    .get(ownerId) as
                    | {
                          id: string;
                          name: string;
                          url: string;
                      }
                    | null
                    | undefined;

                if (!row) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const nodeCountRow = db
                    .query("SELECT COUNT(1) AS count FROM flow_nodes WHERE owner_id = ?")
                    .get(ownerId) as { count: number } | null;
                const flowCountRow = db
                    .query(
                        "SELECT COUNT(DISTINCT flow_id) AS count FROM flow_nodes WHERE owner_id = ?",
                    )
                    .get(ownerId) as { count: number } | null;

                const [clones, productionClone] = await Promise.all([
                    findRepositoryClones({ repositoryUrl: row.url, clonesDir }),
                    getProductionCloneInfo({ repositoryUrl: row.url, productionDir }),
                ]);

                let remoteBranch = null;
                const preferredClonePath = clones.find((clone) => clone.isWorktree === false)?.path;
                const remoteCheckPath =
                    preferredClonePath ??
                    (productionClone.exists ? productionClone.path : clones[0]?.path);
                if (remoteCheckPath) {
                    try {
                        remoteBranch = await getRemoteBranchUpdateStatus(remoteCheckPath);
                    } catch {
                        remoteBranch = null;
                    }
                }

                return Response.json({
                    id: row.id,
                    name: row.name,
                    url: row.url,
                    consoleRepositoryUrl,
                    nodeCount: nodeCountRow?.count ?? 0,
                    flowCount: flowCountRow?.count ?? 0,
                    clones,
                    productionClone,
                    remoteBranch,
                });
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

                const description =
                    typeof body?.description === "string" ? body.description.trim() : "";
                if (!description) {
                    return new Response(
                        JSON.stringify({ error: "Idea description is required." }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const ownerId = randomUUID();
                db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'idea')").run(ownerId);
                db.query("INSERT INTO ideas (id, description) VALUES (?, ?)").run(
                    ownerId,
                    description,
                );
                return Response.json({ id: ownerId, ownerType: "idea", description });
            },
        },

        "/api/ideas/:id": {
            async PUT(req: Server.Request) {
                const ownerId = req.params.id;
                const ownerRow = db
                    .query("SELECT owner_type FROM owners WHERE id = ?")
                    .get(ownerId) as { owner_type: "project" | "idea" } | null | undefined;
                if (!ownerRow || ownerRow.owner_type !== "idea") {
                    return new Response(JSON.stringify({ error: "Idea not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const description =
                    typeof body?.description === "string" ? body.description.trim() : "";
                if (!description) {
                    return new Response(
                        JSON.stringify({ error: "Idea description is required." }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                db.query("UPDATE ideas SET description = ? WHERE id = ?").run(description, ownerId);
                return Response.json({ id: ownerId, ownerType: "idea", description });
            },
        },
    } as const;
}
