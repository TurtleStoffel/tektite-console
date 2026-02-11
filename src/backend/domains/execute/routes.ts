import type { Server } from "bun";
import { createExecuteService } from "./service";

export function createExecuteRoutes(options: { clonesDir: string }) {
    const service = createExecuteService({ clonesDir: options.clonesDir });

    return {
        "/api/execute": {
            async POST(req: Server.Request) {
                let payload: unknown;
                try {
                    payload = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const parsedPayload = payload as {
                    command?: unknown;
                    prompt?: unknown;
                    repository?: { url?: unknown };
                };
                const basePrompt =
                    typeof parsedPayload.command === "string"
                        ? parsedPayload.command.trim()
                        : typeof parsedPayload.prompt === "string"
                          ? parsedPayload.prompt.trim()
                          : "";
                const repositoryUrl =
                    typeof parsedPayload.repository?.url === "string"
                        ? parsedPayload.repository.url.trim()
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
                    return await service.execute({ prompt: basePrompt, repositoryUrl });
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
