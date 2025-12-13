import { serve } from "bun";
import index from "./index.html";
import { ensureClonesDir } from "./backend/git";
import { initStorage } from "./backend/storage";
import { createExecuteRoutes } from "./backend/routes/execute";
import { createFlowRoutes } from "./backend/routes/flow";
import { createGithubRoutes } from "./backend/routes/github";
import { helloRoutes } from "./backend/routes/hello";
import { createOwnerRoutes } from "./backend/routes/owners";

const dataDir = "./data";
const selectionFilePath = `${dataDir}/selected-repo.json`;
const clonesDir = "/Users/stefan/coding/tmp/clones";

void ensureClonesDir(clonesDir);
const { db } = await initStorage(dataDir);

const server = serve({
    routes: {
        ...createGithubRoutes({ dataDir, selectionFilePath }),
        ...createFlowRoutes({ db }),
        ...createOwnerRoutes({ db }),
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

console.log(`🚀 Server running at ${server.url}`);
