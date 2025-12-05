import { serve } from "bun";
import index from "./index.html";
import type { GithubRepo } from "./types/github";

async function fetchGithubRepos(): Promise<GithubRepo[]> {
    const repoFields = ["name", "owner", "description", "visibility", "url", "updatedAt"].join(",");

    const process = Bun.spawn(
        ["gh", "repo", "list", "--limit", "100", "--json", repoFields],
        {
            stdout: "pipe",
            stderr: "pipe",
        },
    );

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
                        error instanceof Error ? error.message : "Unknown error while reading gh CLI output.";
                    return new Response(
                        JSON.stringify({ error: message }),
                        {
                            status: 500,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
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
    },

    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
    },
});

console.log(`🚀 Server running at ${server.url}`);
