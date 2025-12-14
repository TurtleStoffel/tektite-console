import type { Server } from "bun";
import fs from "node:fs";
import path from "node:path";
import { isWorktreeDir } from "../git";
import { isWorkspaceActive } from "../workspaceActivity";
import { getDevServerLogs, isDevInstallRunning, isDevServerRunning, startDevServer } from "../devServer";
import { isWithinRoot } from "./pathUtils";

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
                    return new Response(JSON.stringify({ error: "Worktree path is outside configured folders." }), {
                        status: 403,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const exists = fs.existsSync(worktreePath);
                if (!exists) {
                    return new Response(JSON.stringify({ error: "Worktree path does not exist." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
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
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const rawPath = typeof body?.path === "string" ? body.path.trim() : "";
                if (!rawPath) {
                    return new Response(JSON.stringify({ error: "Worktree path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const worktreePath = path.resolve(rawPath);
                const allowed = isWithinRoot(worktreePath, clonesDir);
                if (!allowed) {
                    return new Response(JSON.stringify({ error: "Worktree path is outside configured folders." }), {
                        status: 403,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                if (!fs.existsSync(worktreePath)) {
                    return new Response(JSON.stringify({ error: "Worktree path does not exist." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
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
                    const message = error instanceof Error ? error.message : "Failed to start dev server.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
