import fs from "node:fs";
import path from "node:path";
import { markWorkspaceActive, markWorkspaceInactive } from "./workspaceActivity";

type StreamName = "stdout" | "stderr";
type LogPartials = { stdout: string; stderr: string };

const MAX_LOG_LINES = 2000;

export type BunAppRunnerStartResult =
    | { status: "already-running"; pid: number }
    | { status: "already-installing"; pid: number }
    | { status: "installing"; pid: number }
    | { status: "started"; pid: number };

export type BunAppRunnerLogs = {
    lines: string[];
    partial: LogPartials;
    running: boolean;
    installing: boolean;
};

function isPidAlive(pid: number) {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function defaultNeedsBunInstall(workspacePath: string) {
    try {
        const packageJsonPath = path.join(workspacePath, "package.json");
        if (!fs.existsSync(packageJsonPath)) return false;
        const nodeModulesPath = path.join(workspacePath, "node_modules");
        return !fs.existsSync(nodeModulesPath);
    } catch {
        return false;
    }
}

export function createBunAppRunner(options: {
    label: string;
    nodeEnv: "development" | "production";
    startCommand: readonly string[];
    needsBunInstall?: (workspacePath: string) => boolean;
}) {
    const servers = new Map<string, Bun.Process>();
    const installs = new Map<string, Bun.Process>();
    const logs = new Map<string, string[]>();
    const logPartials = new Map<string, LogPartials>();
    const needsInstall = options.needsBunInstall ?? defaultNeedsBunInstall;

    function appendLogLine(workspacePath: string, line: string) {
        const list = logs.get(workspacePath) ?? [];
        list.push(line);
        if (list.length > MAX_LOG_LINES) {
            list.splice(0, list.length - MAX_LOG_LINES);
        }
        logs.set(workspacePath, list);
    }

    async function consumeStream(args: {
        workspacePath: string;
        stream: ReadableStream<Uint8Array>;
        streamName: StreamName;
    }) {
        const { workspacePath, stream, streamName } = args;
        const decoder = new TextDecoder();
        const reader = stream.getReader();
        const partial = logPartials.get(workspacePath) ?? { stdout: "", stderr: "" };
        logPartials.set(workspacePath, partial);

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
                    appendLogLine(workspacePath, `[${streamName}] ${rawLine}`);
                }
            }
        } catch {
            // Best-effort log capture.
        } finally {
            const leftover = partial[streamName];
            if (leftover.trim()) {
                appendLogLine(workspacePath, `[${streamName}] ${leftover.trimEnd()}`);
                partial[streamName] = "";
            }
            try {
                reader.releaseLock();
            } catch {
                // ignore
            }
        }
    }

    function reconcileProcesses(workspacePath: string) {
        const install = installs.get(workspacePath);
        if (install && !isPidAlive(install.pid)) {
            installs.delete(workspacePath);
            appendLogLine(workspacePath, `[system] ${options.label} install process no longer running`);
            if (!servers.has(workspacePath)) {
                markWorkspaceInactive(workspacePath);
            }
        }

        const server = servers.get(workspacePath);
        if (server && !isPidAlive(server.pid)) {
            servers.delete(workspacePath);
            appendLogLine(workspacePath, `[system] ${options.label} process no longer running`);
            markWorkspaceInactive(workspacePath);
        }
    }

    function getLogs(workspacePath: string): BunAppRunnerLogs {
        reconcileProcesses(workspacePath);
        const list = logs.get(workspacePath) ?? [];
        const partial = logPartials.get(workspacePath);
        return {
            lines: list,
            partial: partial ? { ...partial } : { stdout: "", stderr: "" },
            running: servers.has(workspacePath),
            installing: installs.has(workspacePath),
        };
    }

    function isServerRunning(workspacePath: string) {
        reconcileProcesses(workspacePath);
        return servers.has(workspacePath);
    }

    function isInstallRunning(workspacePath: string) {
        reconcileProcesses(workspacePath);
        return installs.has(workspacePath);
    }

    function spawnInstallThenStart(workspacePath: string): BunAppRunnerStartResult {
        const install = Bun.spawn(["bun", "install"], {
            cwd: workspacePath,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...Bun.env,
                NODE_ENV: options.nodeEnv,
            },
        });

        installs.set(workspacePath, install);
        markWorkspaceActive(workspacePath);
        appendLogLine(workspacePath, "[system] running bun install");
        if (install.stdout) void consumeStream({ workspacePath, stream: install.stdout, streamName: "stdout" });
        if (install.stderr) void consumeStream({ workspacePath, stream: install.stderr, streamName: "stderr" });

        void install.exited.then((code) => {
            const current = installs.get(workspacePath);
            if (current !== install) return;
            installs.delete(workspacePath);

            if (code !== 0) {
                appendLogLine(workspacePath, `[system] bun install failed (exit ${code ?? "unknown"})`);
                if (!servers.has(workspacePath)) markWorkspaceInactive(workspacePath);
                return;
            }

            appendLogLine(workspacePath, "[system] bun install complete");
            void start(workspacePath, { skipInstall: true });
        });

        return { status: "installing", pid: install.pid };
    }

    function spawnServer(workspacePath: string): BunAppRunnerStartResult {
        const serverProcess = Bun.spawn([...options.startCommand], {
            cwd: workspacePath,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...Bun.env,
                NODE_ENV: options.nodeEnv,
            },
        });

        servers.set(workspacePath, serverProcess);
        markWorkspaceActive(workspacePath);

        appendLogLine(workspacePath, `[system] started ${options.label}`);
        if (serverProcess.stdout)
            void consumeStream({ workspacePath, stream: serverProcess.stdout, streamName: "stdout" });
        if (serverProcess.stderr)
            void consumeStream({ workspacePath, stream: serverProcess.stderr, streamName: "stderr" });

        void serverProcess.exited.then(() => {
            const current = servers.get(workspacePath);
            if (current === serverProcess) {
                servers.delete(workspacePath);
                if (!installs.has(workspacePath)) markWorkspaceInactive(workspacePath);
                appendLogLine(workspacePath, `[system] ${options.label} exited`);
            }
        });

        return { status: "started", pid: serverProcess.pid };
    }

    function start(workspacePath: string, flags?: { skipInstall?: boolean }): BunAppRunnerStartResult {
        reconcileProcesses(workspacePath);

        const existingServer = servers.get(workspacePath);
        if (existingServer) return { status: "already-running", pid: existingServer.pid };

        const existingInstall = installs.get(workspacePath);
        if (existingInstall) return { status: "already-installing", pid: existingInstall.pid };

        if (!flags?.skipInstall && needsInstall(workspacePath)) {
            return spawnInstallThenStart(workspacePath);
        }

        return spawnServer(workspacePath);
    }

    return { getLogs, start, isServerRunning, isInstallRunning };
}

