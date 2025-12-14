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
import { TEKTITE_PORT_FILE } from "./constants";
import { findFirstFreePort } from "./backend/port";
import { startPullRequestCleanup } from "./backend/worktreeCleanup";
import path from "node:path";

const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
const PORT = Number.isFinite(portEnv) ? portEnv : findFirstFreePort(3000);
const portFilePath = TEKTITE_PORT_FILE;

const dataDir = "./data";
const selectionFilePath = `${dataDir}/selected-repo.json`;
const clonesDir = "/Users/stefan/coding/tmp/clones";
const productionDir = path.join(path.dirname(clonesDir), "production");
const codingFolder = "/Users/stefan/coding";

void ensureClonesDir(clonesDir);
void ensureClonesDir(productionDir);
const { db } = await initStorage(dataDir);

startPullRequestCleanup({ clonesDir });

const server = serve({
    port: PORT,

    // Disable timeout for long-running Codex requests
    idleTimeout: 0,

    routes: {
        ...createGithubRoutes({ dataDir, selectionFilePath }),
        ...createFlowRoutes({ db }),
        ...createOwnerRoutes({ db, clonesDir, codingFolder, productionDir }),
        ...helloRoutes,
        ...createExecuteRoutes({ clonesDir }),
        ...createDevServerRoutes({ clonesDir, codingFolder }),
        ...createProductionServerRoutes({ productionDir }),

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
