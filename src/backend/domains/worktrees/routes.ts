import fs from "node:fs";
import path from "node:path";
import type { Server } from "bun";
import { isWorktreeDir } from "../../git";
import { isWithinRoot } from "../../http/pathUtils";
import { isWorkspaceActive } from "../../workspaceActivity";
import {
    getDevServerLogs,
    isDevInstallRunning,
    isDevServerRunning,
    startDevServer,
} from "./devServer";

export function createDevServerRoutes(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        "/api/worktrees/dev-logs": {
            async GET(req: Server.Request) {
                const url = new URL(req.url);
                const rawPath = url.searchParams.get("path")?.trim() ?? "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Worktree path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const worktreePath = path.resolve(rawPath);
                const allowed = isWithinRoot(worktreePath, clonesDir);
                if (!allowed) {
                    return new Response(
                        JSON.stringify({ error: "Worktree path is outside configured folders." }),
                        {
                            status: 403,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const exists = fs.existsSync(worktreePath);
                if (!exists) {
                    return new Response(
                        JSON.stringify({ error: "Worktree path does not exist." }),
                        {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (!isWorktreeDir(worktreePath)) {
                    return new Response(JSON.stringify({ error: "Path is not a git worktree." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const logs = getDevServerLogs(worktreePath);
                return Response.json({
                    path: worktreePath,
                    exists,
                    running: logs.running,
                    installing: logs.installing,
                    lines: logs.lines,
                    partial: logs.partial,
                });
            },
        },

        "/api/worktrees/dev-server": {
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

                const parsedBody = body as { path?: unknown };
                const rawPath = typeof parsedBody.path === "string" ? parsedBody.path.trim() : "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Worktree path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const worktreePath = path.resolve(rawPath);
                const allowed = isWithinRoot(worktreePath, clonesDir);
                if (!allowed) {
                    return new Response(
                        JSON.stringify({ error: "Worktree path is outside configured folders." }),
                        {
                            status: 403,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (!fs.existsSync(worktreePath)) {
                    return new Response(
                        JSON.stringify({ error: "Worktree path does not exist." }),
                        {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (!isWorktreeDir(worktreePath)) {
                    return new Response(JSON.stringify({ error: "Path is not a git worktree." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                if (isDevServerRunning(worktreePath) || isDevInstallRunning(worktreePath)) {
                    const result = startDevServer(worktreePath);
                    return Response.json(result);
                }

                if (isWorkspaceActive(worktreePath)) {
                    return new Response(JSON.stringify({ error: "Worktree is already active." }), {
                        status: 409,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                try {
                    const result = startDevServer(worktreePath);
                    return Response.json(result);
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Failed to start dev server.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
