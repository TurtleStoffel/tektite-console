import * as repository from "./repository";

export function createEditorService(options: { clonesDir: string }) {
    return {
        async openVscode(rawPath: string) {
            const target = repository.resolveAllowedFolder(options, rawPath);
            if (!target.allowed) {
                return {
                    error: "Folder path is outside configured folders.",
                    status: 403 as const,
                };
            }
            if (!target.exists) {
                return { error: "Folder path does not exist.", status: 404 as const };
            }

            try {
                await repository.openInCode(target.folderPath);
                return { ok: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to open VSCode.";
                if (message.includes("ENOENT") || message.includes("not found")) {
                    return {
                        error: "VSCode CLI not found. Install the `code` command and ensure it's on PATH.",
                        status: 500 as const,
                    };
                }

                return { error: message, status: 500 as const };
            }
        },
    };
}
