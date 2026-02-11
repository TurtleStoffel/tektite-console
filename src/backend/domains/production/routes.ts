import fs from "node:fs";
import type { Server } from "bun";
import { isWithinRoot } from "../../http/pathUtils";
import { ensureProductionClone, getProductionClonePath } from "../../productionClone";
import {
    getProductionServerLogs,
    isProductionInstallRunning,
    isProductionServerRunning,
    startProductionServer,
} from "../../productionServer";
import { isWorkspaceActive } from "../../workspaceActivity";

export function createProductionServerRoutes(options: { productionDir: string }) {
    const { productionDir } = options;

    return {
        "/api/production/logs": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const repositoryUrl = url.searchParams.get("repositoryUrl")?.trim() ?? "";
                if (!repositoryUrl) {
                    return new Response(JSON.stringify({ error: "Repository URL is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const clonePath = getProductionClonePath(repositoryUrl, productionDir);
                if (!isWithinRoot(clonePath, productionDir)) {
                    return new Response(
                        JSON.stringify({
                            error: "Production clone path is outside configured folder.",
                        }),
                        {
                            status: 403,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const exists = fs.existsSync(clonePath);
                const logs = getProductionServerLogs(clonePath);
                return Response.json({
                    path: clonePath,
                    exists,
                    running: logs.running,
                    installing: logs.installing,
                    lines: logs.lines,
                    partial: logs.partial,
                });
            },
        },

        "/api/production/start": {
            async POST(req: Server.Request) {
                let body: unknown;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const parsedBody = body as { repositoryUrl?: unknown };
                const repositoryUrl =
                    typeof parsedBody.repositoryUrl === "string"
                        ? parsedBody.repositoryUrl.trim()
                        : "";
                if (!repositoryUrl) {
                    return new Response(JSON.stringify({ error: "Repository URL is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                let clonePath: string;
                try {
                    const result = await ensureProductionClone({ repositoryUrl, productionDir });
                    clonePath = result.clonePath;
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Failed to prepare production clone.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                if (!isWithinRoot(clonePath, productionDir)) {
                    return new Response(
                        JSON.stringify({
                            error: "Production clone path is outside configured folder.",
                        }),
                        {
                            status: 403,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (!fs.existsSync(clonePath)) {
                    return new Response(
                        JSON.stringify({ error: "Production clone path does not exist." }),
                        {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (isProductionServerRunning(clonePath) || isProductionInstallRunning(clonePath)) {
                    const result = startProductionServer(clonePath);
                    return Response.json({ ...result, path: clonePath });
                }

                if (isWorkspaceActive(clonePath)) {
                    return new Response(
                        JSON.stringify({ error: "Production clone is already active." }),
                        {
                            status: 409,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                try {
                    const result = startProductionServer(clonePath);
                    return Response.json({ ...result, path: clonePath });
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Failed to start production server.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
