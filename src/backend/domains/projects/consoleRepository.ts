import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeRepoUrl } from "../../../shared/normalizeRepoUrl";

type PackageJson = {
    repository?: string | { url?: string };
};

let cached: string | null | undefined;

export function getConsoleRepositoryUrl(): string | null {
    if (cached !== undefined) return cached;

    try {
        const packageJsonPath = fileURLToPath(new URL("../../../../package.json", import.meta.url));
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson;

        const repository =
            typeof parsed.repository === "string"
                ? parsed.repository
                : typeof parsed.repository?.url === "string"
                  ? parsed.repository.url
                  : null;

        cached = normalizeRepoUrl(repository);
        return cached;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to read repository ${message}`);
        cached = null;
        return cached;
    }
}
