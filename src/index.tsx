import { serve } from "bun";
import { rmSync } from "node:fs";
import index from "./index.html";
import { ensureClonesDir } from "./backend/git";
import { initStorage } from "./backend/storage";
import { createExecuteRoutes } from "./backend/routes/execute";
import { createFlowRoutes } from "./backend/routes/flow";
import { createGithubRoutes } from "./backend/routes/github";
import { helloRoutes } from "./backend/routes/hello";
import { createOwnerRoutes } from "./backend/routes/owners";
import { createDevServerRoutes } from "./backend/routes/devServer";
import { createProductionServerRoutes } from "./backend/routes/productionServer";
import { createEditorRoutes } from "./backend/routes/editor";
import { envRoutes } from "./backend/routes/env";
import { TEKTITE_PORT_FILE } from "./constants";
import { findFirstFreePort } from "./backend/port";
import { startPullRequestCleanup } from "./backend/worktreeCleanup";
import path from "node:path";

const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
const PORT = Number.isFinite(portEnv) ? portEnv : findFirstFreePort(3000);
const portFilePath = TEKTITE_PORT_FILE;

function expandHome(p: string): string {
    const home = Bun.env.HOME;
    if (!home) return p;
    return p.startsWith("~") ? p.replace(/^~(?=$|[\\/])/, home) : p;
}

function resolvePathFromEnv(raw: string): string {
    return path.resolve(expandHome(raw.trim()));
}

const dataDirValue = process.env.DATA_DIR;
if (!dataDirValue) {
    throw new Error("Missing required env var: DATA_DIR.");
}
const dataDir = resolvePathFromEnv(dataDirValue);

const clonesDirValue = process.env.CLONES_DIR;
if (!clonesDirValue) {
    throw new Error("Missing required env var: CLONES_DIR.");
}
const clonesDir = resolvePathFromEnv(clonesDirValue);
const productionDir = path.join(path.dirname(clonesDir), "production");

void ensureClonesDir(clonesDir);
void ensureClonesDir(productionDir);
const { db } = await initStorage(dataDir);

startPullRequestCleanup({ clonesDir });

const server = serve({
    port: PORT,

    // Disable timeout for long-running Codex requests
    idleTimeout: 0,

    routes: {
        ...envRoutes,
        ...createGithubRoutes(),
        ...createFlowRoutes({ db }),
        ...createOwnerRoutes({ db, clonesDir, productionDir }),
        ...helloRoutes,
        ...createExecuteRoutes({ clonesDir }),
        ...createDevServerRoutes({ clonesDir }),
        ...createProductionServerRoutes({ productionDir }),
        ...createEditorRoutes({ clonesDir, productionDir }),

        // Serve index.html for all unmatched routes.
        "/*": index,
    },

    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
    },
});

await Bun.write(portFilePath, String(server.port));

const cleanupPortFile = () => {
    try {
        rmSync(portFilePath, { force: true });
    } catch (error) {
        console.warn(`Failed to remove ${portFilePath}`, error);
    }
};
process.on("exit", cleanupPortFile);
process.on("SIGINT", () => {
    cleanupPortFile();
    process.exit(0);
});
process.on("SIGTERM", () => {
    cleanupPortFile();
    process.exit(0);
});

console.log(`🚀 Server running at ${server.url}`);
