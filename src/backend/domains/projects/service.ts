import { Result } from "typescript-result";
import * as repository from "./repository";

export const projectsService = {
    async getProjectById(projectId: string) {
        const project = await repository.findProjectById(projectId);
        if (!project) {
            return Result.error({
                type: "project-not-found" as const,
                message: "Project not found.",
            });
        }
        return Result.ok(project);
    },
};
