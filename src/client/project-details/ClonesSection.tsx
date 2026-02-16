import { useState } from "react";
import { Link } from "react-router-dom";
import { DevTerminalPanel } from "../DevTerminalPanel";
import { prBadgeClass, prBadgeLabel } from "./helpers";
import type { ProjectDetailsClone } from "./types";

type ClonesSectionProps = {
    clones: ProjectDetailsClone[] | undefined;
    actionError: string | null;
    onDismissActionError: () => void;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    openDevTerminals: Record<string, boolean>;
    devTerminalSessions: Record<string, string | null>;
    onOpenDevTerminal: (worktreePath: string, key: string) => void;
    onOpenInVSCode: (folderPath: string) => void;
    onToggleDevTerminal: (worktreePath: string, isOpen: boolean) => void;
    onResumeCodexThread: (worktreePath: string, threadId: string, comment: string) => Promise<void>;
};

export function ClonesSection({
    clones,
    actionError,
    onDismissActionError,
    startingDevKey,
    openingVSCodePath,
    openDevTerminals,
    devTerminalSessions,
    onOpenInVSCode,
    onOpenDevTerminal,
    onToggleDevTerminal,
    onResumeCodexThread,
}: ClonesSectionProps) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold">Local clones</div>
                    <div className="text-xs text-base-content/60">
                        Worktrees, repository status, and dev terminals
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/60">{clones?.length ?? 0}</span>
                </div>
            </div>

            {actionError && (
                <div className="alert alert-error py-2">
                    <div className="flex items-center justify-between gap-3 w-full">
                        <span className="text-sm">{actionError}</span>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={onDismissActionError}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {!clones || clones.length === 0 ? (
                <div className="rounded-xl border border-base-300 bg-base-100/50 p-4 text-sm text-base-content/70">
                    No clones found in configured folders.
                </div>
            ) : (
                <div className="space-y-3">
                    {clones.map((clone) => (
                        <CloneCard
                            key={`clone:${clone.path}`}
                            clone={clone}
                            actionKey={`clone:${clone.path}`}
                            startingDevKey={startingDevKey}
                            openingVSCodePath={openingVSCodePath}
                            devTerminalOpen={openDevTerminals[clone.path] ?? false}
                            devTerminalSessionId={devTerminalSessions[clone.path] ?? null}
                            onOpenInVSCode={onOpenInVSCode}
                            onOpenDevTerminal={onOpenDevTerminal}
                            onToggleDevTerminal={onToggleDevTerminal}
                            onResumeCodexThread={onResumeCodexThread}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

type CloneCardProps = {
    clone: ProjectDetailsClone;
    actionKey: string;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    devTerminalOpen: boolean;
    devTerminalSessionId: string | null;
    onOpenInVSCode: (folderPath: string) => void;
    onOpenDevTerminal: (worktreePath: string, key: string) => void;
    onToggleDevTerminal: (worktreePath: string, isOpen: boolean) => void;
    onResumeCodexThread: (worktreePath: string, threadId: string, comment: string) => Promise<void>;
};

function CloneCard({
    clone,
    actionKey,
    startingDevKey,
    openingVSCodePath,
    devTerminalOpen,
    devTerminalSessionId,
    onOpenInVSCode,
    onOpenDevTerminal,
    onToggleDevTerminal,
    onResumeCodexThread,
}: CloneCardProps) {
    const isStarting = startingDevKey === actionKey;
    const isOpeningVSCode = openingVSCodePath === clone.path;
    const hasDevTerminalSession = Boolean(devTerminalSessionId);
    const [comment, setComment] = useState("");
    const [commentError, setCommentError] = useState<string | null>(null);
    const [submittingComment, setSubmittingComment] = useState(false);
    const dependenciesLink = `/dependencies?${new URLSearchParams({ path: clone.path }).toString()}`;

    const terminalButtonLabel = isStarting
        ? "Opening"
        : devTerminalOpen
          ? "Hide terminal"
          : hasDevTerminalSession
            ? "Show terminal"
            : "Open terminal";

    const canSendComment =
        Boolean(clone.codexThreadId) && Boolean(comment.trim()) && !submittingComment;

    return (
        <article className="space-y-2">
            <div className="p-4 border border-base-300 rounded-xl bg-base-100/80 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                        <div className="font-mono text-xs break-all">{clone.path}</div>
                        {clone.commitHash && clone.commitDescription && (
                            <div className="text-xs text-base-content/70 break-all">
                                <span className="font-mono">{clone.commitHash.slice(0, 12)}</span>
                                <span className="mx-2">-</span>
                                <span>{clone.commitDescription}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {clone.isWorktree && <div className="badge badge-outline">worktree</div>}

                        {clone.isWorktree && (
                            <div
                                className={`badge badge-outline whitespace-nowrap ${
                                    clone.inUse ? "badge-error" : "badge-ghost"
                                }`}
                            >
                                {clone.inUse ? "in use" : "idle"}
                            </div>
                        )}

                        {typeof clone.hasChanges === "boolean" && (
                            <div
                                className={`badge badge-outline ${
                                    clone.hasChanges ? "badge-warning" : "badge-success"
                                }`}
                            >
                                {clone.hasChanges ? "changes" : "clean"}
                            </div>
                        )}

                        {clone.isWorktree && clone.prStatus && (
                            <div
                                className={`badge badge-outline whitespace-nowrap ${prBadgeClass(
                                    clone.prStatus.state,
                                )}`}
                            >
                                {prBadgeLabel(clone.prStatus)}
                            </div>
                        )}

                        {typeof clone.port === "number" && (
                            <div className="badge badge-success badge-outline">
                                port {clone.port}
                            </div>
                        )}
                    </div>
                </div>

                {clone.isWorktree &&
                    (clone.prStatus?.state === "open" || clone.prStatus?.state === "draft") &&
                    clone.prStatus.url && (
                        <a
                            className="link link-hover text-xs break-all"
                            href={clone.prStatus.url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            View PR{" "}
                            {typeof clone.prStatus.number === "number"
                                ? `#${clone.prStatus.number}`
                                : ""}
                            {clone.prStatus.title ? ` - ${clone.prStatus.title}` : ""}
                        </a>
                    )}

                <div className="flex flex-wrap items-center gap-2">
                    <Link to={dependenciesLink} className="btn btn-outline btn-sm">
                        Dependencies
                    </Link>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={Boolean(openingVSCodePath)}
                        onClick={() => onOpenInVSCode(clone.path)}
                    >
                        {isOpeningVSCode && <span className="loading loading-spinner loading-xs" />}
                        {isOpeningVSCode ? "Opening" : "Open VSCode"}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={Boolean(startingDevKey)}
                        onClick={() => {
                            if (devTerminalOpen) {
                                onToggleDevTerminal(clone.path, false);
                                return;
                            }
                            if (hasDevTerminalSession) {
                                onToggleDevTerminal(clone.path, true);
                                return;
                            }
                            onOpenDevTerminal(clone.path, actionKey);
                        }}
                    >
                        {isStarting && <span className="loading loading-spinner loading-xs" />}
                        {terminalButtonLabel}
                    </button>
                </div>
            </div>

            {devTerminalOpen && devTerminalSessionId && (
                <DevTerminalPanel sessionId={devTerminalSessionId} />
            )}

            {clone.isWorktree &&
                (clone.codexThreadId || clone.codexLastMessage || clone.codexLastEvent) && (
                    <div className="p-3 border border-base-300 rounded-xl bg-base-200/50 space-y-2">
                        <div className="text-xs font-semibold text-base-content/70">Codex log</div>
                        {clone.codexThreadId && (
                            <div className="font-mono text-xs text-base-content/70 break-all">
                                thread: {clone.codexThreadId}
                            </div>
                        )}
                        {clone.codexLastEvent && (
                            <div className="text-xs text-base-content/70 break-all">
                                event: {clone.codexLastEvent}
                            </div>
                        )}
                        {clone.codexLastMessage && (
                            <div className="text-sm break-words whitespace-pre-wrap">
                                {clone.codexLastMessage}
                            </div>
                        )}
                        <div className="form-control gap-2 pt-1">
                            <textarea
                                placeholder="Add a follow-up comment to this Codex thread"
                                className="textarea textarea-bordered w-full min-h-[80px] text-sm"
                                value={comment}
                                onChange={(event) => setComment(event.target.value)}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={!canSendComment}
                                    onClick={() => {
                                        const trimmedComment = comment.trim();
                                        if (!clone.codexThreadId) {
                                            setCommentError(
                                                "No Codex thread is available for this clone.",
                                            );
                                            return;
                                        }
                                        if (!trimmedComment) {
                                            setCommentError(
                                                "Enter a comment to resume this thread.",
                                            );
                                            return;
                                        }

                                        setCommentError(null);
                                        setSubmittingComment(true);
                                        void onResumeCodexThread(
                                            clone.path,
                                            clone.codexThreadId,
                                            trimmedComment,
                                        )
                                            .then(() => {
                                                setComment("");
                                            })
                                            .catch((error) => {
                                                const message =
                                                    error instanceof Error
                                                        ? error.message
                                                        : "Failed to resume Codex thread.";
                                                setCommentError(message);
                                            })
                                            .finally(() => {
                                                setSubmittingComment(false);
                                            });
                                    }}
                                >
                                    {submittingComment ? "Sending..." : "Resume with comment"}
                                </button>
                            </div>
                            {commentError && (
                                <div className="text-xs text-error break-words">{commentError}</div>
                            )}
                        </div>
                    </div>
                )}
        </article>
    );
}
