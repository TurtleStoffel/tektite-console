import fs from "node:fs";
import path from "node:path";
import type { Server } from "bun";
import { execFileAsync } from "../exec";
import { isWithinRoot } from "./pathUtils";

export function createEditorRoutes(options: { clonesDir: string; productionDir: string }) {
    const { clonesDir, productionDir } = options;

    return {
        "/api/editor/open-vscode": {
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
                    return new Response(JSON.stringify({ error: "Folder path is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const folderPath = path.resolve(rawPath);
                const allowed =
                    isWithinRoot(folderPath, clonesDir) || isWithinRoot(folderPath, productionDir);
                if (!allowed) {
                    return new Response(
                        JSON.stringify({ error: "Folder path is outside configured folders." }),
                        {
                            status: 403,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                if (!fs.existsSync(folderPath)) {
                    return new Response(JSON.stringify({ error: "Folder path does not exist." }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                try {
                    await execFileAsync("code", ["."], { cwd: folderPath, timeout: 10_000 });
                    return Response.json({ ok: true });
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Failed to open VSCode.";
                    if (message.includes("ENOENT") || message.includes("not found")) {
                        return new Response(
                            JSON.stringify({
                                error: "VSCode CLI not found. Install the `code` command and ensure it's on PATH.",
                            }),
                            { status: 500, headers: { "Content-Type": "application/json" } },
                        );
                    }
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}
