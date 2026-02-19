import fs from "node:fs";
import path from "node:path";

const COMMIT_AND_PR_INSTRUCTION =
    "Before finishing, write your desired commit message into commit-details.txt";
const WORKTREE_THREADS_FILENAME = "worktree-threads.json";

type ThreadMetadata = {
    threadId: string;
    lastMessage?: string;
    lastEvent?: string;
};

function threadMapPath(clonesDir: string) {
    return path.join(clonesDir, WORKTREE_THREADS_FILENAME);
}

export function readThreadMap(clonesDir: string): Record<string, ThreadMetadata> {
    try {
        const mapPath = threadMapPath(clonesDir);
        if (!fs.existsSync(mapPath)) {
            return {};
        }

        const raw = fs.readFileSync(mapPath, "utf8").trim();
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return {};
        }

        const entries = Object.entries(parsed)
            .map(([key, value]) => {
                if (typeof value === "string") {
                    return [key, { threadId: value } satisfies ThreadMetadata] as const;
                }

                if (
                    value &&
                    typeof value === "object" &&
                    typeof (value as { threadId?: unknown }).threadId === "string"
                ) {
                    const threadId = (value as { threadId: string }).threadId;
                    const lastMessage =
                        typeof (value as { lastMessage?: unknown }).lastMessage === "string"
                            ? (value as { lastMessage: string }).lastMessage
                            : undefined;
                    const lastEvent =
                        typeof (value as { lastEvent?: unknown }).lastEvent === "string"
                            ? (value as { lastEvent: string }).lastEvent
                            : undefined;
                    return [
                        key,
                        { threadId, lastMessage, lastEvent } satisfies ThreadMetadata,
                    ] as const;
                }

                return null;
            })
            .filter((entry): entry is [string, ThreadMetadata] => Boolean(entry));

        return Object.fromEntries(entries) as Record<string, ThreadMetadata>;
    } catch (error) {
        console.warn("Failed to read thread map", error);
        return {};
    }
}

function writeThreadMap(clonesDir: string, map: Record<string, ThreadMetadata>) {
    try {
        const mapPath = threadMapPath(clonesDir);
        fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
    } catch (error) {
        console.warn("Failed to write thread map", error);
    }
}

export function recordThreadId(clonesDir: string, worktreePath: string, threadId?: string | null) {
    if (!worktreePath || !threadId) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (existing?.threadId === threadId) {
        return;
    }

    threadMap[worktreePath] = {
        threadId,
        lastMessage: existing?.lastMessage,
        lastEvent: existing?.lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

export function recordLastMessage(
    clonesDir: string,
    worktreePath: string,
    lastMessage?: string | null,
) {
    if (!worktreePath || !lastMessage) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (!existing?.threadId) {
        return;
    }

    if (existing.lastMessage === lastMessage) {
        return;
    }

    threadMap[worktreePath] = {
        threadId: existing.threadId,
        lastMessage,
        lastEvent: existing.lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

export function recordLastEvent(
    clonesDir: string,
    worktreePath: string,
    lastEvent?: string | null,
) {
    if (!worktreePath || !lastEvent) {
        return;
    }

    const threadMap = readThreadMap(clonesDir);
    const existing = threadMap[worktreePath];
    if (!existing?.threadId) {
        return;
    }

    if (existing.lastEvent === lastEvent) {
        return;
    }

    threadMap[worktreePath] = {
        threadId: existing.threadId,
        lastMessage: existing.lastMessage,
        lastEvent,
    };
    writeThreadMap(clonesDir, threadMap);
}

export function appendCommitInstruction(prompt: string) {
    return `${prompt}\n\n${COMMIT_AND_PR_INSTRUCTION}`;
}
