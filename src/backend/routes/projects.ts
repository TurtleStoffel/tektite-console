import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Server } from "bun";
import { findRepositoryClones } from "../cloneDiscovery";
import { getConsoleRepositoryUrl } from "../consoleRepository";
import { getProductionCloneInfo } from "../productionClone";
import { getRemoteBranchUpdateStatus } from "../remoteUpdates";

export function createProjectRoutes(options: {
    db: Database;
    clonesDir: string;
    productionDir: string;
}) {
    const { db, clonesDir, productionDir } = options;

    const consoleRepositoryUrl = getConsoleRepositoryUrl();

    return {
        "/api/projects": {
            async GET() {
                const projects = db
                    .query(
                        `
                        SELECT
                            id,
                            name
                        FROM projects
                        ORDER BY name ASC
                        `,
                    )
                    .all() as Array<{
                    id: string;
                    name: string | null;
                    url: string | null;
                }>;

                const normalized = projects.map((project) => ({
                    id: project.id,
                    name: project.name,
                    url: project.url,
                }));

                return Response.json({ projects: normalized });
            },
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

                const projectId = randomUUID();
                db.query("INSERT INTO projects (id, name, url) VALUES (?, ?, ?)").run(
                    projectId,
                    name,
                    url,
                );
                return Response.json({ id: projectId, name, url });
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const projectId = req.params.id;
                const row = db
                    .query(
                        `
                        SELECT
                            id,
                            name
                        FROM projects
                        WHERE id = ?
                        `,
                    )
                    .get(projectId) as
                    | {
                          id: string;
                          name: string;
                          url: string | null;
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
                    .query("SELECT COUNT(1) AS count FROM flow_nodes WHERE project_id = ?")
                    .get(projectId) as { count: number } | null;
                const flowCountRow = db
                    .query(
                        "SELECT COUNT(DISTINCT flow_id) AS count FROM flow_nodes WHERE project_id = ?",
                    )
                    .get(projectId) as { count: number } | null;

                const repositoryUrl = row.url?.trim() || null;
                const [clones, productionClone] = repositoryUrl
                    ? await Promise.all([
                          findRepositoryClones({ repositoryUrl, clonesDir }),
                          getProductionCloneInfo({ repositoryUrl, productionDir }),
                      ])
                    : [[], null];

                let remoteBranch = null;

                const serverCwd = process.cwd();
                const serverCwdClone = clones.find(
                    (clone) =>
                        serverCwd === clone.path || serverCwd.startsWith(clone.path + path.sep),
                );
                const inUseClone = clones.find((clone) => clone.inUse);
                const anyWorktreeClone = clones.find((clone) => clone.isWorktree);
                const nonWorktreeClone = clones.find((clone) => clone.isWorktree === false);

                const productionCloneChoice = productionClone?.exists
                    ? { path: productionClone.path, reason: "productionClone" }
                    : null;

                const remoteCheckChoice =
                    (serverCwdClone && { path: serverCwdClone.path, reason: "serverCwd" }) ||
                    (inUseClone && { path: inUseClone.path, reason: "inUse" }) ||
                    (anyWorktreeClone && { path: anyWorktreeClone.path, reason: "worktree" }) ||
                    (nonWorktreeClone && { path: nonWorktreeClone.path, reason: "nonWorktree" }) ||
                    productionCloneChoice ||
                    (clones[0]?.path && { path: clones[0].path, reason: "firstClone" }) ||
                    null;

                const remoteCheckPath = remoteCheckChoice?.path ?? null;
                if (remoteCheckPath) {
                    console.log("[remote-updates] selecting repo for remote check", {
                        projectId,
                        repositoryUrl,
                        remoteCheckPath,
                        reason: remoteCheckChoice?.reason,
                        serverCwd,
                        cloneCount: clones.length,
                        productionCloneExists: productionClone?.exists ?? false,
                    });
                    try {
                        remoteBranch = await getRemoteBranchUpdateStatus(remoteCheckPath);
                    } catch (error) {
                        console.warn("[remote-updates] remote check failed", {
                            projectId,
                            remoteCheckPath,
                            error,
                        });
                        remoteBranch = null;
                    }
                }

                return Response.json({
                    id: row.id,
                    name: row.name,
                    url: repositoryUrl,
                    consoleRepositoryUrl,
                    nodeCount: nodeCountRow?.count ?? 0,
                    flowCount: flowCountRow?.count ?? 0,
                    clones,
                    productionClone,
                    remoteBranch,
                });
            },
        },
    } as const;
}
