import type { Server } from "bun";
import { streamCodexRun } from "../codex";
import { ensureClonesDir, prepareWorktree } from "../git";

export function createExecuteRoutes(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        "/api/execute": {
            async POST(req: Server.Request) {
                let payload: any;
                try {
                    payload = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const basePrompt =
                    typeof payload?.command === "string"
                        ? payload.command.trim()
                        : typeof payload?.prompt === "string"
                          ? payload.prompt.trim()
                          : "";
                const repositoryUrl =
                    typeof payload?.repository?.url === "string"
                        ? payload.repository.url.trim()
                        : "";

                if (!basePrompt) {
                    return new Response(JSON.stringify({ error: "Command text is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                if (!repositoryUrl) {
                    return new Response(
                        JSON.stringify({ error: "Select a repository before executing." }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                try {
                    await ensureClonesDir(clonesDir);
                    const { worktreePath } = await prepareWorktree(repositoryUrl, clonesDir);
                    return streamCodexRun({
                        prompt: basePrompt,
                        workingDirectory: worktreePath,
                        clonesDir,
                    });
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Failed to prepare repository for execution.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
