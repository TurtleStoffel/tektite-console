import { mkdir } from "fs/promises";
import type { Server } from "bun";
import type { GithubRepo } from "../../types/github";

type SelectionMap = Record<string, string>;

async function readSelectionMap(selectionFilePath: string): Promise<SelectionMap> {
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

async function writeSelectionMap(dataDir: string, selectionFilePath: string, map: SelectionMap): Promise<void> {
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
    } catch {
        throw new Error("Received invalid JSON from gh CLI.");
    }
}

export function createGithubRoutes(options: { dataDir: string; selectionFilePath: string }) {
    const { dataDir, selectionFilePath } = options;

    return {
        "/api/github/repos": {
            async GET() {
                try {
                    const repos = await fetchGithubRepos();
                    return Response.json({ repos });
                } catch (error) {
                    console.error("Failed to fetch GitHub repos from gh CLI:", error);
                    const message =
                        error instanceof Error ? error.message : "Unknown error while reading gh CLI output.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },

        "/api/github/selection": {
            async GET() {
                const selection = await readSelectionMap(selectionFilePath);
                return Response.json({ selection });
            },
            async PUT(req: Server.Request) {
                try {
                    const body = await req.json();
                    const cell = body?.cell;
                    const url = body?.url;

                    if (typeof cell !== "number" || cell < 1) {
                        return new Response(JSON.stringify({ error: "A valid cell number is required." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    if (typeof url !== "string" || !url.trim()) {
                        return new Response(JSON.stringify({ error: "A valid repository URL is required." }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        });
                    }

                    const selection = await readSelectionMap(selectionFilePath);
                    selection[String(cell)] = url.trim();
                    await writeSelectionMap(dataDir, selectionFilePath, selection);
                    return Response.json({ selection });
                } catch (error) {
                    console.error("Failed to persist selected repo:", error);
                    const message =
                        error instanceof Error ? error.message : "Unknown error writing selection file.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    } as const;
}

