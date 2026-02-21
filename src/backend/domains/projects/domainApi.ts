import { randomUUID } from "node:crypto";
import { findRepositoryClones } from "./cloneDiscovery";
import * as repository from "./repository";

export function createProjectsService(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        async listProjects() {
            const rows = await repository.listProjects();
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
                const linkedRepository = await repository.findRepositoryById(input.repositoryId);
                if (!linkedRepository)
                    return { error: "Repository not found.", status: 400 as const };

                const alreadyLinked = await repository.hasProjectForRepository(input.repositoryId);
                if (alreadyLinked) {
                    return { error: "Repository already has a project.", status: 409 as const };
                }

                linkedRepositoryUrl = linkedRepository.url;
            }

            const projectId = randomUUID();
            await repository.createProject({
                id: projectId,
                name: input.name,
                repositoryId: input.repositoryId || null,
            });
            return { id: projectId, name: input.name, url: linkedRepositoryUrl };
        },

        async getProject(projectId: string) {
            const project = await repository.findProjectById(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };

            const repositoryUrl = project.url?.trim() || null;
            let clones = repositoryUrl
                ? await findRepositoryClones({ repositoryUrl, clonesDir })
                : [];
            const worktreePaths = clones
                .filter((clone) => clone.isWorktree)
                .map((clone) => clone.path);
            const promptSummaryRows =
                await repository.listWorktreePromptSummariesByPaths(worktreePaths);
            const promptSummaryByWorktreePath = new Map(
                promptSummaryRows.map((row) => [row.worktreePath, row.promptSummary]),
            );
            clones = clones.map((clone) => ({
                ...clone,
                promptSummary: clone.isWorktree
                    ? (promptSummaryByWorktreePath.get(clone.path) ?? null)
                    : null,
            }));
            return {
                id: project.id,
                name: project.name,
                repositoryId: project.repositoryId ?? null,
                url: repositoryUrl,
                clones,
            };
        },

        async updateProjectRepository(input: { projectId: string; repositoryId: string | null }) {
            if (input.repositoryId) {
                const linkedRepository = await repository.findRepositoryById(input.repositoryId);
                if (!linkedRepository)
                    return { error: "Repository not found.", status: 400 as const };

                const alreadyLinked = await repository.hasOtherProjectForRepository({
                    projectId: input.projectId,
                    repositoryId: input.repositoryId,
                });
                if (alreadyLinked) {
                    return { error: "Repository already has a project.", status: 409 as const };
                }
            }

            const updatedRows = await repository.updateProjectRepository(input);
            if (updatedRows.length === 0)
                return { error: "Project not found.", status: 404 as const };

            const updatedProject = await repository.findProjectById(input.projectId);
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
            const deleted = await repository.deleteProject(projectId);
            if (deleted.length === 0) return { error: "Project not found.", status: 404 as const };

            console.info("[projects] deleted", { projectId });
            return { id: projectId };
        },
    };
}
