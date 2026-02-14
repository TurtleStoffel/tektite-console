import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ServerWebSocket } from "bun";
import { spawn } from "bun-pty";
import { markTerminalWorkspaceActive, markTerminalWorkspaceInactive } from "./workspaceActivity";

type TerminalSession = {
    id: string;
    workspacePath: string;
    pty: PtyLike;
    sockets: Set<ServerWebSocket<TerminalSocketData>>;
    startedAt: string;
};

type PtyLike = {
    pid: number;
    write: (data: string) => void;
    resize?: (cols: number, rows: number) => void;
    kill: () => void;
    onData: (handler: (data: string) => void) => void;
    onExit: (handler: () => void) => void;
};

export type TerminalSocketData = {
    sessionId: string;
};

const sessionsById = new Map<string, TerminalSession>();
const sessionIdByWorkspace = new Map<string, string>();

function closeSession(session: TerminalSession) {
    sessionsById.delete(session.id);
    sessionIdByWorkspace.delete(session.workspacePath);
    for (const socket of session.sockets) {
        socket.close();
    }
    markTerminalWorkspaceInactive(session.workspacePath);
}

function createTerminalSession(workspacePath: string): TerminalSession {
    const normalizedWorkspacePath = path.resolve(workspacePath);
    const pty = spawn("/bin/sh", ["-i"], {
        cwd: normalizedWorkspacePath,
        name: "xterm-256color",
        env: {
            ...Bun.env,
            NODE_ENV: "development",
        },
        cols: 120,
        rows: 40,
    }) as PtyLike;
    const session: TerminalSession = {
        id: randomUUID(),
        workspacePath: normalizedWorkspacePath,
        pty,
        sockets: new Set(),
        startedAt: new Date().toISOString(),
    };

    sessionsById.set(session.id, session);
    sessionIdByWorkspace.set(normalizedWorkspacePath, session.id);
    markTerminalWorkspaceActive(normalizedWorkspacePath);

    pty.onData((data) => {
        const payload = JSON.stringify({ type: "output", data });
        for (const socket of session.sockets) {
            socket.send(payload);
        }
    });

    pty.onExit(() => {
        const payload = JSON.stringify({ type: "exit" });
        for (const socket of session.sockets) {
            socket.send(payload);
        }
        closeSession(session);
    });

    return session;
}

export function startOrReuseTerminal(workspacePath: string) {
    const normalizedWorkspacePath = path.resolve(workspacePath);
    const existingSessionId = sessionIdByWorkspace.get(normalizedWorkspacePath);
    const existingSession = existingSessionId ? sessionsById.get(existingSessionId) : undefined;
    if (existingSession) {
        return {
            sessionId: existingSession.id,
            pid: existingSession.pty.pid,
            startedAt: existingSession.startedAt,
            status: "already-running" as const,
        };
    }

    const session = createTerminalSession(normalizedWorkspacePath);
    return {
        sessionId: session.id,
        pid: session.pty.pid,
        startedAt: session.startedAt,
        status: "started" as const,
    };
}

export function getTerminalSessionById(sessionId: string) {
    return sessionsById.get(sessionId);
}

export function getTerminalSessionByWorkspacePath(workspacePath: string) {
    const normalizedWorkspacePath = path.resolve(workspacePath);
    const sessionId = sessionIdByWorkspace.get(normalizedWorkspacePath);
    if (!sessionId) return null;
    const session = sessionsById.get(sessionId);
    if (!session) {
        sessionIdByWorkspace.delete(normalizedWorkspacePath);
        return null;
    }
    return {
        sessionId: session.id,
        pid: session.pty.pid,
        startedAt: session.startedAt,
    };
}

export function handleTerminalSocketMessage(
    session: TerminalSession,
    rawMessage: string | Buffer | Uint8Array,
) {
    const text = typeof rawMessage === "string" ? rawMessage : rawMessage.toString();
    let payload: unknown = null;
    try {
        payload = JSON.parse(text);
    } catch {
        return;
    }

    if (!payload || typeof payload !== "object") return;
    if (!("type" in payload)) return;
    if (payload.type === "input" && "data" in payload && typeof payload.data === "string") {
        session.pty.write(payload.data);
        return;
    }
    if (
        payload.type === "resize" &&
        "cols" in payload &&
        "rows" in payload &&
        typeof payload.cols === "number" &&
        typeof payload.rows === "number"
    ) {
        session.pty.resize?.(payload.cols, payload.rows);
    }
}

export function attachSocketToTerminalSession(
    sessionId: string,
    socket: ServerWebSocket<TerminalSocketData>,
) {
    const session = sessionsById.get(sessionId);
    if (!session) return null;
    session.sockets.add(socket);
    socket.send(JSON.stringify({ type: "ready" }));
    return session;
}

export function detachSocketFromTerminalSession(
    sessionId: string,
    socket: ServerWebSocket<TerminalSocketData>,
) {
    const session = sessionsById.get(sessionId);
    if (!session) return;
    session.sockets.delete(socket);
}
