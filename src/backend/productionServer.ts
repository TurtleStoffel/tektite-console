import { markWorkspaceActive, markWorkspaceInactive } from "./workspaceActivity";
import fs from "node:fs";
import path from "node:path";

const productionServers = new Map<string, Bun.Process>();
const productionInstalls = new Map<string, Bun.Process>();
const productionLogs = new Map<string, string[]>();
const productionLogPartials = new Map<string, { stdout: string; stderr: string }>();
const MAX_LOG_LINES = 2000;

export function isProductionServerRunning(clonePath: string) {
    return productionServers.has(clonePath);
}

export function isProductionInstallRunning(clonePath: string) {
    return productionInstalls.has(clonePath);
}

function isPidAlive(pid: number) {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function appendLogLine(clonePath: string, line: string) {
    const list = productionLogs.get(clonePath) ?? [];
    list.push(line);
    if (list.length > MAX_LOG_LINES) {
        list.splice(0, list.length - MAX_LOG_LINES);
    }
    productionLogs.set(clonePath, list);
}

async function consumeStream(options: {
    clonePath: string;
    stream: ReadableStream<Uint8Array>;
    streamName: "stdout" | "stderr";
}) {
    const { clonePath, stream, streamName } = options;
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    const partial = productionLogPartials.get(clonePath) ?? { stdout: "", stderr: "" };
    productionLogPartials.set(clonePath, partial);

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value || value.length === 0) continue;
            const text = decoder.decode(value, { stream: true });
            const prev = partial[streamName];
            const combined = prev + text;
            const normalized = combined.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            const lines = normalized.split("\n");
            partial[streamName] = lines.pop() ?? "";

            for (const rawLine of lines) {
                appendLogLine(clonePath, `[${streamName}] ${rawLine}`);
            }
        }
    } catch {
        // Best-effort log capture.
    } finally {
        const leftover = partial[streamName];
        if (leftover.trim()) {
            appendLogLine(clonePath, `[${streamName}] ${leftover.trimEnd()}`);
            partial[streamName] = "";
        }
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

function reconcileProcesses(clonePath: string) {
    const install = productionInstalls.get(clonePath);
    if (install && !isPidAlive(install.pid)) {
        productionInstalls.delete(clonePath);
        appendLogLine(clonePath, "[system] npm install process no longer running");
        if (!productionServers.has(clonePath)) {
            markWorkspaceInactive(clonePath);
        }
    }

    const server = productionServers.get(clonePath);
    if (server && !isPidAlive(server.pid)) {
        productionServers.delete(clonePath);
        appendLogLine(clonePath, "[system] production server process no longer running");
        markWorkspaceInactive(clonePath);
    }
}

export function getProductionServerLogs(clonePath: string) {
    reconcileProcesses(clonePath);
    const list = productionLogs.get(clonePath) ?? [];
    const partial = productionLogPartials.get(clonePath);
    return {
        lines: list,
        partial: partial ? { ...partial } : { stdout: "", stderr: "" },
        running: productionServers.has(clonePath),
        installing: productionInstalls.has(clonePath),
    };
}

function needsNpmInstall(clonePath: string) {
    try {
        const packageJsonPath = path.join(clonePath, "package.json");
        if (!fs.existsSync(packageJsonPath)) return false;
        const nodeModulesPath = path.join(clonePath, "node_modules");
        return !fs.existsSync(nodeModulesPath);
    } catch {
        return false;
    }
}

function spawnInstallThenStart(clonePath: string) {
    const install = Bun.spawn(["npm", "install"], {
        cwd: clonePath,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
            ...Bun.env,
            NODE_ENV: "production",
        },
    });

    productionInstalls.set(clonePath, install);
    markWorkspaceActive(clonePath);
    appendLogLine(clonePath, "[system] running npm install");
    if (install.stdout) void consumeStream({ clonePath, stream: install.stdout, streamName: "stdout" });
    if (install.stderr) void consumeStream({ clonePath, stream: install.stderr, streamName: "stderr" });

    void install.exited.then((code) => {
        const current = productionInstalls.get(clonePath);
        if (current !== install) return;
        productionInstalls.delete(clonePath);

        if (code !== 0) {
            appendLogLine(clonePath, `[system] npm install failed (exit ${code ?? "unknown"})`);
            markWorkspaceInactive(clonePath);
            return;
        }

        appendLogLine(clonePath, "[system] npm install complete");
        void startProductionServer(clonePath);
    });

    return { status: "installing" as const, pid: install.pid };
}

export function startProductionServer(clonePath: string) {
    const existing = productionServers.get(clonePath);
    if (existing) {
        return { status: "already-running" as const, pid: existing.pid };
    }

    const existingInstall = productionInstalls.get(clonePath);
    if (existingInstall) {
        return { status: "already-installing" as const, pid: existingInstall.pid };
    }

    if (needsNpmInstall(clonePath)) {
        return spawnInstallThenStart(clonePath);
    }

    const process = Bun.spawn(["bun", "run", "start"], {
        cwd: clonePath,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
            ...Bun.env,
            NODE_ENV: "production",
        },
    });

    productionServers.set(clonePath, process);
    markWorkspaceActive(clonePath);

    appendLogLine(clonePath, "[system] started production server");
    if (process.stdout) void consumeStream({ clonePath, stream: process.stdout, streamName: "stdout" });
    if (process.stderr) void consumeStream({ clonePath, stream: process.stderr, streamName: "stderr" });

    void process.exited.then(() => {
        const current = productionServers.get(clonePath);
        if (current === process) {
            productionServers.delete(clonePath);
            markWorkspaceInactive(clonePath);
            appendLogLine(clonePath, "[system] production server exited");
        }
    });

    return { status: "started" as const, pid: process.pid };
}
