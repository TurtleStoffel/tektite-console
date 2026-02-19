import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ClonesSection } from "./ClonesSection";
import { buildPreviewTargets } from "./helpers";
import { LivePreviewSection } from "./LivePreviewSection";
import type { PreviewTarget, ProjectDetailsPayload } from "./types";
import { SelectedWorktreeDetails, WorktreeSelector } from "./WorktreesDisplay";

type WorktreePanelProps = {
    project: ProjectDetailsPayload;
    onRefreshProject: () => Promise<void>;
    onWorktreeDetailsOpenChange: (isOpen: boolean) => void;
    taskExecutionContent?: ReactNode;
};

export function WorktreePanel({
    project,
    onRefreshProject,
    onWorktreeDetailsOpenChange,
    taskExecutionContent,
}: WorktreePanelProps) {
    const queryClient = useQueryClient();
    const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
    const [startingDevKey, setStartingDevKey] = useState<string | null>(null);
    const [openingVSCodePath, setOpeningVSCodePath] = useState<string | null>(null);
    const [openDevTerminals, setOpenDevTerminals] = useState<Record<string, boolean>>({});
    const [devTerminalSessions, setDevTerminalSessions] = useState<Record<string, string | null>>(
        {},
    );
    const [actionError, setActionError] = useState<string | null>(null);
    const [selectedWorktreePath, setSelectedWorktreePath] = useState<string | null>(null);

    const previewTargets = useMemo<PreviewTarget[]>(() => {
        return buildPreviewTargets(project);
    }, [project]);

    useEffect(() => {
        if (previewTargets.length === 0) {
            setActivePreviewKey(null);
            return;
        }

        const firstKey = previewTargets[0]?.key ?? null;
        setActivePreviewKey((prev) => {
            if (prev && previewTargets.some((target) => target.key === prev)) return prev;
            return firstKey;
        });
    }, [previewTargets]);

    const worktrees = useMemo(() => {
        return (project.clones ?? []).filter((clone) => clone.isWorktree);
    }, [project.clones]);

    useEffect(() => {
        if (!selectedWorktreePath) return;
        if (worktrees.some((worktree) => worktree.path === selectedWorktreePath)) return;
        setSelectedWorktreePath(null);
    }, [selectedWorktreePath, worktrees]);

    const selectedWorktree = useMemo(() => {
        if (!selectedWorktreePath) return null;
        return worktrees.find((worktree) => worktree.path === selectedWorktreePath) ?? null;
    }, [selectedWorktreePath, worktrees]);

    const selectedWorktreePreviewTargets = useMemo<PreviewTarget[]>(() => {
        if (!selectedWorktree) return [];
        return previewTargets.filter((target) => target.key === `clone:${selectedWorktree.path}`);
    }, [previewTargets, selectedWorktree]);

    useEffect(() => {
        onWorktreeDetailsOpenChange(Boolean(selectedWorktree));
    }, [selectedWorktree, onWorktreeDetailsOpenChange]);

    useEffect(() => {
        if (!selectedWorktree) return;
        const firstSelectedPreviewKey = selectedWorktreePreviewTargets[0]?.key ?? null;
        setActivePreviewKey(firstSelectedPreviewKey);
    }, [selectedWorktree, selectedWorktreePreviewTargets]);

    const activePreviewTarget = previewTargets.find((target) => target.key === activePreviewKey);
    const previewPort = activePreviewTarget?.port ?? null;
    const previewProtocol =
        typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
    const previewHost =
        typeof window !== "undefined" && window.location.hostname
            ? window.location.hostname
            : "localhost";
    const previewUrl =
        typeof previewPort === "number"
            ? `${previewProtocol}://${previewHost}:${previewPort}/`
            : null;

    const startDevTerminal = async (worktreePath: string, key: string) => {
        setActionError(null);
        setStartingDevKey(key);
        setOpenDevTerminals((prev) => ({ ...prev, [worktreePath]: true }));
        try {
            const res = await fetch("/api/worktrees/dev-terminal/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: worktreePath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to start terminal.");
            }
            const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : null;
            setDevTerminalSessions((prev) => ({
                ...prev,
                [worktreePath]: sessionId,
            }));
            await onRefreshProject();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to start terminal.";
            setActionError(message);
        } finally {
            setStartingDevKey(null);
        }
    };

    const openInVSCode = async (folderPath: string) => {
        setActionError(null);
        setOpeningVSCodePath(folderPath);
        try {
            const res = await fetch("/api/editor/open-vscode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: folderPath }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to open VSCode.");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to open VSCode.";
            setActionError(message);
        } finally {
            setOpeningVSCodePath(null);
        }
    };

    const resumeCodexThreadWithComment = async (
        worktreePath: string,
        threadId: string,
        comment: string,
    ) => {
        setActionError(null);
        const res = await fetch("/api/resume", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify({
                comment,
                projectId: project.id,
                worktreePath,
                threadId,
            }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.error || "Failed to resume Codex thread.");
        }

        if (!res.body) {
            throw new Error("Server did not return a streaming response.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processEvent = (rawEvent: string) => {
            const dataLines = rawEvent
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.replace(/^data:\s?/, ""))
                .filter(Boolean);
            if (!dataLines.length) return;

            const payload = JSON.parse(dataLines.join("\n")) as { type?: string; error?: string };
            if (payload.type === "error") {
                throw new Error(payload.error || "Codex run failed.");
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let boundaryIndex = buffer.indexOf("\n\n");
            while (boundaryIndex !== -1) {
                const rawEvent = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                processEvent(rawEvent);
                boundaryIndex = buffer.indexOf("\n\n");
            }
        }

        buffer += decoder.decode();
        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            processEvent(rawEvent);
            boundaryIndex = buffer.indexOf("\n\n");
        }

        await onRefreshProject();
        await queryClient.invalidateQueries({
            queryKey: ["project-task-history", project.id],
        });
    };

    return (
        <>
            <WorktreeSelector
                worktrees={worktrees}
                selectedWorktreePath={selectedWorktreePath}
                onSelectWorktree={(worktreePath) => setSelectedWorktreePath(worktreePath)}
                onClearSelection={() => setSelectedWorktreePath(null)}
            />

            <div className="space-y-6">
                {taskExecutionContent}
                <div className="card bg-base-200 border border-base-300 shadow-sm">
                    <div className="card-body p-5 sm:p-6 space-y-5">
                        {selectedWorktree ? (
                            <SelectedWorktreeDetails
                                selectedWorktree={selectedWorktree}
                                selectedWorktreePreviewTargets={selectedWorktreePreviewTargets}
                                activePreviewKey={activePreviewKey}
                                previewUrl={previewUrl}
                                startingDevKey={startingDevKey}
                                openingVSCodePath={openingVSCodePath}
                                devTerminalOpen={openDevTerminals[selectedWorktree.path] ?? false}
                                devTerminalSessionId={
                                    devTerminalSessions[selectedWorktree.path] ?? null
                                }
                                onOpenInVSCode={(path) => void openInVSCode(path)}
                                onOpenDevTerminal={(path, key) => void startDevTerminal(path, key)}
                                onToggleDevTerminal={(worktreePath, isOpen) =>
                                    setOpenDevTerminals((prev) => ({
                                        ...prev,
                                        [worktreePath]: isOpen,
                                    }))
                                }
                                onResumeCodexThread={(worktreePath, threadId, comment) =>
                                    resumeCodexThreadWithComment(worktreePath, threadId, comment)
                                }
                                onChangeActivePreviewKey={(key) => setActivePreviewKey(key)}
                            />
                        ) : (
                            <>
                                <ClonesSection
                                    clones={project.clones}
                                    actionError={actionError}
                                    onDismissActionError={() => setActionError(null)}
                                    startingDevKey={startingDevKey}
                                    openingVSCodePath={openingVSCodePath}
                                    openDevTerminals={openDevTerminals}
                                    devTerminalSessions={devTerminalSessions}
                                    onOpenInVSCode={(path) => void openInVSCode(path)}
                                    onOpenDevTerminal={(path, key) =>
                                        void startDevTerminal(path, key)
                                    }
                                    onToggleDevTerminal={(worktreePath, isOpen) =>
                                        setOpenDevTerminals((prev) => ({
                                            ...prev,
                                            [worktreePath]: isOpen,
                                        }))
                                    }
                                    onResumeCodexThread={(worktreePath, threadId, comment) =>
                                        resumeCodexThreadWithComment(
                                            worktreePath,
                                            threadId,
                                            comment,
                                        )
                                    }
                                />
                                <LivePreviewSection
                                    previewTargets={previewTargets}
                                    activePreviewKey={activePreviewKey}
                                    previewUrl={previewUrl}
                                    onChangeActivePreviewKey={(key) => setActivePreviewKey(key)}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
