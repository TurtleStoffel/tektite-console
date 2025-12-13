import { mkdir } from "fs/promises";
import { serve } from "bun";
import index from "./index.html";
import type { GithubRepo } from "./types/github";
import { ensureClonesDir, prepareWorktree } from "./backend/git";
import { streamCodexRun } from "./backend/codex";

const dataDir = "./data";
const selectionFilePath = `${dataDir}/selected-repo.json`;
const clonesDir = "/Users/stefan/coding/tmp/clones";

void ensureClonesDir(clonesDir);

type SelectionMap = Record<string, string>;

async function readSelectionMap(): Promise<SelectionMap> {
    const file = Bun.file(selectionFilePath);
    if (!(await file.exists())) return {};

    try {
        const content = await file.text();
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
            return parsed as SelectionMap;
        }
        return {};
    } catch (error) {
        console.error("Failed to read selection file:", error);
        return {};
    }
}

async function writeSelectionMap(map: SelectionMap): Promise<void> {
    const payload = JSON.stringify(map, null, 2);
    await mkdir(dataDir, { recursive: true });
    await Bun.write(selectionFilePath, payload);
}

async function fetchGithubRepos(): Promise<GithubRepo[]> {
    const repoFields = ["name", "owner", "description", "visibility", "url", "updatedAt"].join(",");

    const process = Bun.spawn(["gh", "repo", "list", "--limit", "100", "--json", repoFields], {
        stdout: "pipe",
        stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
    ]);

    if (exitCode !== 0) {
        throw new Error(stderr.trim() || "Unable to list repositories via gh CLI.");
    }

    try {
        const parsed = JSON.parse(stdout);
        return parsed;
    } catch (error) {
        throw new Error("Received invalid JSON from gh CLI.");
    }
}

const server = serve({
    routes: {
        // Serve index.html for all unmatched routes.
        "/*": index,

        "/api/github/repos": {
            async GET() {
                try {
                    const repos = await fetchGithubRepos();
                    return Response.json({ repos });
                } catch (error) {
                    console.error("Failed to fetch GitHub repos from gh CLI:", error);
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Unknown error while reading gh CLI output.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },

        "/api/github/selection": {
            async GET() {
                const selection = await readSelectionMap();
                return Response.json({ selection });
            },
            async PUT(req) {
                try {
                    const body = await req.json();
                    const cell = body?.cell;
                    const url = body?.url;

                    if (typeof cell !== "number" || cell < 1) {
                        return new Response(
                            JSON.stringify({ error: "A valid cell number is required." }),
                            {
                                status: 400,
                                headers: { "Content-Type": "application/json" },
                            },
                        );
                    }

                    if (typeof url !== "string" || !url.trim()) {
                        return new Response(
                            JSON.stringify({ error: "A valid repository URL is required." }),
                            {
                                status: 400,
                                headers: { "Content-Type": "application/json" },
                            },
                        );
                    }

                    const selection = await readSelectionMap();
                    selection[String(cell)] = url.trim();
                    await writeSelectionMap(selection);
                    return Response.json({ selection });
                } catch (error) {
                    console.error("Failed to persist selected repo:", error);
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Unknown error writing selection file.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },

        "/api/hello": {
            async GET(req) {
                return Response.json({
                    message: "Hello, world!",
                    method: "GET",
                });
            },
            async PUT(req) {
                return Response.json({
                    message: "Hello, world!",
                    method: "PUT",
                });
            },
        },

        "/api/hello/:name": async (req) => {
            const name = req.params.name;
            return Response.json({
                message: `Hello, ${name}!`,
            });
        },

        "/api/execute": {
            async POST(req) {
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
                    typeof payload?.repository?.url === "string" ? payload.repository.url.trim() : "";

                if (!basePrompt) {
                    return new Response(JSON.stringify({ error: "Command text is required." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                if (!repositoryUrl) {
                    return new Response(JSON.stringify({ error: "Select a repository before executing." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                try {
                    await ensureClonesDir(clonesDir);
                    const { worktreePath } = await prepareWorktree(repositoryUrl, clonesDir);
                    return streamCodexRun({ prompt: basePrompt, workingDirectory: worktreePath, clonesDir });
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Failed to prepare repository for execution.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    },

    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
    },
});

console.log(`🚀 Server running at ${server.url}`);
