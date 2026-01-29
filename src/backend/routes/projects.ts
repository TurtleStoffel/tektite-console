import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Server } from "bun";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, asc, eq, ne } from "drizzle-orm";
import { findRepositoryClones } from "../cloneDiscovery";
import { getConsoleRepositoryUrl } from "../consoleRepository";
import { getProductionCloneInfo } from "../productionClone";
import { getRemoteBranchUpdateStatus } from "../remoteUpdates";
import type * as schema from "../db/schema";
import { projects, repositories } from "../db/schema";

export function createProjectRoutes(options: {
    db: BunSQLiteDatabase<typeof schema>;
    clonesDir: string;
    productionDir: string;
}) {
    const { db, clonesDir, productionDir } = options;

    const consoleRepositoryUrl = getConsoleRepositoryUrl();

    return {
        "/api/projects": {
            async GET() {
                const projectsRows = db
                    .select({
                        id: projects.id,
                        name: projects.name,
                        repositoryId: projects.repositoryId,
                        url: repositories.url,
                    })
                    .from(projects)
                    .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
                    .orderBy(asc(projects.name))
                    .all();

                const normalized = projectsRows.map((project) => ({
                    id: project.id,
                    name: project.name,
                    repositoryId: project.repositoryId ?? null,
                    url: project.url ?? null,
                }));

                return Response.json({ data: normalized });
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
                    repository =
                        db
                            .select({ id: repositories.id, url: repositories.url })
                            .from(repositories)
                            .where(eq(repositories.id, repositoryId))
                            .get() ?? null;

                    if (!repository) {
                        return new Response(JSON.stringify({ error: "Repository not found." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    const existingProject = db
                        .select({ id: projects.id })
                        .from(projects)
                        .where(eq(projects.repositoryId, repositoryId))
                        .get();

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
                db.insert(projects)
                    .values({
                        id: projectId,
                        name,
                        repositoryId: repositoryId || null,
                    })
                    .run();
                return Response.json({ id: projectId, name, url: repository?.url ?? null });
            },
        },

        "/api/projects/:id": {
            async GET(req: Server.Request) {
                const projectId = req.params.id;
                const row = db
                    .select({
                        id: projects.id,
                        name: projects.name,
                        repositoryId: projects.repositoryId,
                        url: repositories.url,
                    })
                    .from(projects)
                    .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
                    .where(eq(projects.id, projectId))
                    .get();

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
                        .select({ id: repositories.id })
                        .from(repositories)
                        .where(eq(repositories.id, repositoryId))
                        .get();

                    if (!repository) {
                        return new Response(JSON.stringify({ error: "Repository not found." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    const existingProject = db
                        .select({ id: projects.id })
                        .from(projects)
                        .where(and(eq(projects.repositoryId, repositoryId), ne(projects.id, projectId)))
                        .get();

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
                    .update(projects)
                    .set({ repositoryId })
                    .where(eq(projects.id, projectId))
                    .run() as { changes: number };

                if (result.changes === 0) {
                    return new Response(JSON.stringify({ error: "Project not found." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const updated = db
                    .select({
                        id: projects.id,
                        name: projects.name,
                        repositoryId: projects.repositoryId,
                        url: repositories.url,
                    })
                    .from(projects)
                    .leftJoin(repositories, eq(projects.repositoryId, repositories.id))
                    .where(eq(projects.id, projectId))
                    .get();

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
                    .delete(projects)
                    .where(eq(projects.id, projectId))
                    .run() as { changes: number };

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
