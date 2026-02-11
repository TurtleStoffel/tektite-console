import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { serve } from "bun";
import { ensureClonesDir } from "./backend/git";
import { findFirstFreePort } from "./backend/port";
import { createDevServerRoutes } from "./backend/routes/devServer";
import { createDocumentRoutes } from "./backend/routes/documents";
import { createEditorRoutes } from "./backend/routes/editor";
import { envRoutes } from "./backend/routes/env";
import { createExecuteRoutes } from "./backend/routes/execute";
import { createGithubRoutes } from "./backend/routes/github";
import { helloRoutes } from "./backend/routes/hello";
import { createProductionServerRoutes } from "./backend/routes/productionServer";
import { createProjectRoutes } from "./backend/routes/projects";
import { createRepositoryRoutes } from "./backend/routes/repositories";
import { initStorage } from "./backend/storage";
import { startPullRequestCleanup } from "./backend/worktreeCleanup";
import index from "./client/index.html";
import { TEKTITE_PORT_FILE } from "./constants";

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

const rawSqlitePath = process.env.SQLITE_PATH?.trim();
const rawDataDir = process.env.DATA_DIR?.trim();
const databasePath = rawSqlitePath
    ? resolvePathFromEnv(rawSqlitePath)
    : rawDataDir
      ? path.join(resolvePathFromEnv(rawDataDir), "tektite.sqlite")
      : path.resolve(".tektite.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });
console.info("[storage] using sqlite database path", { databasePath });

const supabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();
if (!supabaseDatabaseUrl) {
    throw new Error("Missing required env var: SUPABASE_DATABASE_URL.");
}

const clonesDirValue = process.env.CLONES_DIR;
if (!clonesDirValue) {
    throw new Error("Missing required env var: CLONES_DIR.");
}
const clonesDir = resolvePathFromEnv(clonesDirValue);
const productionDir = path.join(path.dirname(clonesDir), "production");

void ensureClonesDir(clonesDir);
void ensureClonesDir(productionDir);
const { localDb } = await initStorage({
    localDatabasePath: databasePath,
    supabaseDatabaseUrl,
});
console.info("[storage] dual database mode enabled", {
    local: "sqlite",
    remote: "supabase",
});

startPullRequestCleanup({ clonesDir });

const corsOrigin = "http://localhost:5173";
const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const withCorsResponse = (response: Response) => {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", corsOrigin);
    headers.set("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
    headers.set("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
    headers.append("Vary", "Origin");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

const corsPreflightResponse = () =>
    new Response(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            Vary: "Origin",
        },
    });

type RouteHandler = (...args: unknown[]) => unknown | Promise<unknown>;
type RouteMethodMap = Record<string, unknown>;
type RouteTable = Record<string, unknown>;

const wrapRouteHandler = (handler: RouteHandler) => {
    return async (...args: unknown[]) => {
        const req = args[0] as Request | undefined;
        if (req?.method === "OPTIONS") {
            return corsPreflightResponse();
        }
        const result = await handler(...args);
        const response = result instanceof Response ? result : new Response(result);
        return withCorsResponse(response);
    };
};

const withCorsRoutes = <T extends RouteTable>(routes: T): T => {
    const entries = Object.entries(routes).map(([route, handler]) => {
        if (!route.startsWith("/api/")) {
            return [route, handler];
        }

        if (typeof handler === "function") {
            return [route, wrapRouteHandler(handler as RouteHandler)];
        }

        if (handler && typeof handler === "object") {
            const methodHandlers = handler as RouteMethodMap;
            const wrapped: RouteMethodMap = {};
            for (const [method, methodHandler] of Object.entries(methodHandlers)) {
                wrapped[method] =
                    typeof methodHandler === "function"
                        ? wrapRouteHandler(methodHandler as RouteHandler)
                        : methodHandler;
            }
            if (!("OPTIONS" in methodHandlers)) {
                wrapped.OPTIONS = corsPreflightResponse;
            }
            return [route, wrapped];
        }

        return [route, handler];
    });

    return Object.fromEntries(entries) as T;
};

const server = serve({
    port: PORT,

    // Disable timeout for long-running Codex requests
    idleTimeout: 0,

    routes: withCorsRoutes({
        ...envRoutes,
        ...createGithubRoutes(),
        ...createDocumentRoutes({ db: localDb }),
        ...createProjectRoutes({ db: localDb, clonesDir, productionDir }),
        ...createRepositoryRoutes({ db: localDb }),
        ...helloRoutes,
        ...createExecuteRoutes({ clonesDir }),
        ...createDevServerRoutes({ clonesDir }),
        ...createProductionServerRoutes({ productionDir }),
        ...createEditorRoutes({ clonesDir, productionDir }),

        // Serve index.html for all unmatched routes.
        "/*": index,
    }),

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
