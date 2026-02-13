import * as repository from "./repository";

export function createProductionService(options: { productionDir: string }) {
    const { productionDir } = options;

    return {
        async start(repositoryUrl: string) {
            let clonePath: string;
            try {
                const result = await repository.ensureClone(productionDir, repositoryUrl);
                clonePath = result.clonePath;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to prepare production clone.";
                return { error: message, status: 500 as const };
            }

            if (!repository.isWithinProductionDir(productionDir, clonePath)) {
                return {
                    error: "Production clone path is outside configured folder.",
                    status: 403 as const,
                };
            }
            if (!repository.cloneExists(clonePath)) {
                return { error: "Production clone path does not exist.", status: 404 as const };
            }

            if (repository.isServerRunning(clonePath) || repository.isInstallRunning(clonePath)) {
                const result = repository.startServer(clonePath);
                return { ...result, path: clonePath };
            }

            if (repository.isCloneWorkspaceActive(clonePath)) {
                return { error: "Production clone is already active.", status: 409 as const };
            }

            try {
                const result = repository.startServer(clonePath);
                return { ...result, path: clonePath };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to start production server.";
                return { error: message, status: 500 as const };
            }
        },

        getProductionCloneInfo(repositoryUrl: string) {
            return repository.readProductionCloneInfo(productionDir, repositoryUrl);
        },
    };
}

export { getProductionCloneInfo } from "./productionClone";
