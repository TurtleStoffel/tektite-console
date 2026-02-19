import { randomUUID } from "node:crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { readThreadMap } from "../../executionState";
import { findRepositoryClones } from "./cloneDiscovery";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

export function createProjectsService(options: { db: Db; clonesDir: string }) {
    const { db, clonesDir } = options;

    return {
        async listProjects() {
            const rows = await repository.listProjects(db);
            return rows.map((project) => ({
                id: project.id,
                name: project.name,
                repositoryId: project.repositoryId ?? null,
                url: project.url ?? null,
            }));
        },

        async createProject(input: { name: string; repositoryId: string }) {
            let linkedRepositoryUrl: string | null = null;

            if (input.repositoryId) {
                const linkedRepository = await repository.findRepositoryById(
                    db,
                    input.repositoryId,
                );
                if (!linkedRepository)
                    return { error: "Repository not found.", status: 400 as const };

                const alreadyLinked = await repository.hasProjectForRepository(
                    db,
                    input.repositoryId,
                );
                if (alreadyLinked) {
                    return { error: "Repository already has a project.", status: 409 as const };
                }

                linkedRepositoryUrl = linkedRepository.url;
            }

            const projectId = randomUUID();
            await repository.createProject(db, {
                id: projectId,
                name: input.name,
                repositoryId: input.repositoryId || null,
            });
            return { id: projectId, name: input.name, url: linkedRepositoryUrl };
        },

        async getProject(projectId: string) {
            const project = await repository.findProjectById(db, projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };

            const repositoryUrl = project.url?.trim() || null;
            const clones = repositoryUrl
                ? await findRepositoryClones({ repositoryUrl, clonesDir })
                : [];
            const threadMap = readThreadMap(clonesDir);
            const clonesWithCodex = clones.map((clone) => {
                const thread = threadMap[clone.path];
                return {
                    ...clone,
                    codexThreadId: thread?.threadId ?? null,
                    codexLastMessage: thread?.lastMessage ?? null,
                    codexLastEvent: thread?.lastEvent ?? null,
                };
            });

            return {
                id: project.id,
                name: project.name,
                repositoryId: project.repositoryId ?? null,
                url: repositoryUrl,
                clones: clonesWithCodex,
            };
        },

        async updateProjectRepository(input: { projectId: string; repositoryId: string | null }) {
            if (input.repositoryId) {
                const linkedRepository = await repository.findRepositoryById(
                    db,
                    input.repositoryId,
                );
                if (!linkedRepository)
                    return { error: "Repository not found.", status: 400 as const };

                const alreadyLinked = await repository.hasOtherProjectForRepository(db, {
                    projectId: input.projectId,
                    repositoryId: input.repositoryId,
                });
                if (alreadyLinked) {
                    return { error: "Repository already has a project.", status: 409 as const };
                }
            }

            const updatedRows = await repository.updateProjectRepository(db, input);
            if (updatedRows.length === 0)
                return { error: "Project not found.", status: 404 as const };

            const updatedProject = await repository.findProjectById(db, input.projectId);
            if (!updatedProject) return { error: "Project not found.", status: 404 as const };

            console.info("[projects] updated repository", {
                projectId: input.projectId,
                repositoryId: input.repositoryId,
            });

            return {
                id: updatedProject.id,
                name: updatedProject.name,
                repositoryId: updatedProject.repositoryId ?? null,
                url: updatedProject.url ?? null,
            };
        },

        async deleteProject(projectId: string) {
            const deleted = await repository.deleteProject(db, projectId);
            if (deleted.length === 0) return { error: "Project not found.", status: 404 as const };

            console.info("[projects] deleted", { projectId });
            return { id: projectId };
        },
    };
}
