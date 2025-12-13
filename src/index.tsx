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

const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
const PORT = Number.isFinite(portEnv) ? portEnv : 3000;
const portFilePath = ".tektite.port";

const dataDir = "./data";
const selectionFilePath = `${dataDir}/selected-repo.json`;
const clonesDir = "/Users/stefan/coding/tmp/clones";
const codingFolder = "/Users/stefan/coding";

void ensureClonesDir(clonesDir);
const { db } = await initStorage(dataDir);

const server = serve({
    port: PORT,
    routes: {
        ...createGithubRoutes({ dataDir, selectionFilePath }),
        ...createFlowRoutes({ db }),
        ...createOwnerRoutes({ db, clonesDir, codingFolder }),
        ...helloRoutes,
        ...createExecuteRoutes({ clonesDir }),

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
