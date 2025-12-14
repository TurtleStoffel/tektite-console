import { markWorkspaceActive, markWorkspaceInactive } from "./workspaceActivity";

const devServers = new Map<string, Bun.Process>();
const devLogs = new Map<string, string[]>();
const devLogPartials = new Map<string, { stdout: string; stderr: string }>();
const MAX_LOG_LINES = 2000;

function isPidAlive(pid: number) {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function appendLogLine(worktreePath: string, line: string) {
    const list = devLogs.get(worktreePath) ?? [];
    list.push(line);
    if (list.length > MAX_LOG_LINES) {
        list.splice(0, list.length - MAX_LOG_LINES);
    }
    devLogs.set(worktreePath, list);
}

async function consumeStream(options: {
    worktreePath: string;
    stream: ReadableStream<Uint8Array>;
    streamName: "stdout" | "stderr";
}) {
    const { worktreePath, stream, streamName } = options;
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    const partial = devLogPartials.get(worktreePath) ?? { stdout: "", stderr: "" };
    devLogPartials.set(worktreePath, partial);

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
                appendLogLine(worktreePath, `[${streamName}] ${rawLine}`);
            }
        }
    } catch {
        // Best-effort log capture.
    } finally {
        const leftover = partial[streamName];
        if (leftover.trim()) {
            appendLogLine(worktreePath, `[${streamName}] ${leftover.trimEnd()}`);
            partial[streamName] = "";
        }
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

function reconcileProcess(worktreePath: string) {
    const server = devServers.get(worktreePath);
    if (server && !isPidAlive(server.pid)) {
        devServers.delete(worktreePath);
        appendLogLine(worktreePath, "[system] dev server process no longer running");
        markWorkspaceInactive(worktreePath);
    }
}

export function isDevServerRunning(worktreePath: string) {
    reconcileProcess(worktreePath);
    return devServers.has(worktreePath);
}

export function getDevServerLogs(worktreePath: string) {
    reconcileProcess(worktreePath);
    const list = devLogs.get(worktreePath) ?? [];
    const partial = devLogPartials.get(worktreePath);
    return {
        lines: list,
        partial: partial ? { ...partial } : { stdout: "", stderr: "" },
        running: devServers.has(worktreePath),
    };
}

export function startDevServer(worktreePath: string) {
    reconcileProcess(worktreePath);
    const existing = devServers.get(worktreePath);
    if (existing) {
        return { status: "already-running" as const, pid: existing.pid };
    }

    const process = Bun.spawn(["bun", "run", "dev"], {
        cwd: worktreePath,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
            ...Bun.env,
            NODE_ENV: "development",
        },
    });

    devServers.set(worktreePath, process);
    markWorkspaceActive(worktreePath);

    appendLogLine(worktreePath, "[system] started dev server");
    if (process.stdout) void consumeStream({ worktreePath, stream: process.stdout, streamName: "stdout" });
    if (process.stderr) void consumeStream({ worktreePath, stream: process.stderr, streamName: "stderr" });

    void process.exited.then(() => {
        const current = devServers.get(worktreePath);
        if (current === process) {
            devServers.delete(worktreePath);
            markWorkspaceInactive(worktreePath);
            appendLogLine(worktreePath, "[system] dev server exited");
        }
    });

    return { status: "started" as const, pid: process.pid };
}
