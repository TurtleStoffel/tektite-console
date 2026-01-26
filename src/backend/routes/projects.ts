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
                            projects.id,
                            projects.name,
                            projects.repository_id AS repositoryId,
                            repositories.url AS url
                        FROM projects
                        LEFT JOIN repositories ON repositories.id = projects.repository_id
                        ORDER BY projects.name ASC
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
                    repositoryId: project.repositoryId ?? null,
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

                const repositoryId =
                    typeof body?.repositoryId === "string" ? body.repositoryId.trim() : "";
                let repository: { id: string; url: string } | null = null;
                if (repositoryId) {
                    repository = db
                        .query("SELECT id, url FROM repositories WHERE id = ?")
                        .get(repositoryId) as { id: string; url: string } | null;

                    if (!repository) {
                        return new Response(JSON.stringify({ error: "Repository not found." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    const existingProject = db
                        .query("SELECT id FROM projects WHERE repository_id = ?")
                        .get(repositoryId) as { id: string } | null;

                    if (existingProject) {
                        return new Response(
                            JSON.stringify({ error: "Repository already has a project." }),
                            {
                                status: 409,
                                headers: { "Content-Type": "application/json" },
                            },
                        );
                    }
                }

                const projectId = randomUUID();
                db.query("INSERT INTO projects (id, name, repository_id) VALUES (?, ?, ?)").run(
                    projectId,
                    name,
                    repositoryId || null,
                );
                return Response.json({ id: projectId, name, url: repository?.url ?? null });
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const projectId = req.params.id;
                const row = db
                    .query(
                        `
                        SELECT
                            projects.id,
                            projects.name,
                            projects.repository_id AS repositoryId,
                            repositories.url AS url
                        FROM projects
                        LEFT JOIN repositories ON repositories.id = projects.repository_id
                        WHERE projects.id = ?
                        `,
                    )
                    .get(projectId) as
                    | {
                          id: string;
                          name: string;
                          repositoryId: string | null;
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
                    repositoryId: row.repositoryId ?? null,
                    url: repositoryUrl,
                    consoleRepositoryUrl,
                    clones,
                    productionClone,
                    remoteBranch,
                });
            },
            async PUT(req: Server.Request) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
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

                const rawRepositoryId =
                    typeof body?.repositoryId === "string" ? body.repositoryId.trim() : null;
                const repositoryId =
                    rawRepositoryId && rawRepositoryId.length > 0 ? rawRepositoryId : null;

                if (repositoryId) {
                    const repository = db
                        .query("SELECT id FROM repositories WHERE id = ?")
                        .get(repositoryId) as { id: string } | null;

                    if (!repository) {
                        return new Response(JSON.stringify({ error: "Repository not found." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    const existingProject = db
                        .query("SELECT id FROM projects WHERE repository_id = ? AND id != ?")
                        .get(repositoryId, projectId) as { id: string } | null;

                    if (existingProject) {
                        return new Response(
                            JSON.stringify({ error: "Repository already has a project." }),
                            {
                                status: 409,
                                headers: { "Content-Type": "application/json" },
                            },
                        );
                    }
                }

                const result = db
                    .query("UPDATE projects SET repository_id = ? WHERE id = ?")
                    .run(repositoryId, projectId) as { changes: number };

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const updated = db
                    .query(
                        `
                        SELECT
                            projects.id,
                            projects.name,
                            projects.repository_id AS repositoryId,
                            repositories.url AS url
                        FROM projects
                        LEFT JOIN repositories ON repositories.id = projects.repository_id
                        WHERE projects.id = ?
                        `,
                    )
                    .get(projectId) as
                    | {
                          id: string;
                          name: string;
                          repositoryId: string | null;
                          url: string | null;
                      }
                    | null
                    | undefined;

                if (!updated) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                console.info("[projects] updated repository", {
                    projectId,
                    repositoryId,
                });

                return Response.json({
                    id: updated.id,
                    name: updated.name,
                    repositoryId: updated.repositoryId ?? null,
                    url: updated.url ?? null,
                });
            },
            async DELETE(req: Server.Request) {
                const projectId = req.params.id ?? null;
                if (!projectId) {
                    return new Response(JSON.stringify({ error: "Project id is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const result = db
                    .query("DELETE FROM projects WHERE id = ?")
                    .run(projectId) as { changes: number };

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                console.info("[projects] deleted", { projectId });
                return Response.json({ id: projectId });
            },
        },
    } as const;
}
