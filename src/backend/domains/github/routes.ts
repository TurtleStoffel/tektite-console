import type { GithubRepo } from "../../../shared/github";

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

export function createGithubRoutes() {
    return {
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
    } as const;
}
