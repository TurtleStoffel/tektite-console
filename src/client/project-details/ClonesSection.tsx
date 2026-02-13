import { DevTerminalPanel } from "../DevTerminalPanel";
import { prBadgeClass, prBadgeLabel } from "./helpers";
import type { ProjectDetailsClone } from "./types";

type ClonesSectionProps = {
    clones: ProjectDetailsClone[] | undefined;
    actionError: string | null;
    onDismissActionError: () => void;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    devTerminalTarget: { key: string; path: string } | null;
    devTerminalSessions: Record<string, string | null>;
    onOpenDevTerminal: (worktreePath: string, key: string) => void;
    onOpenInVSCode: (folderPath: string) => void;
    onToggleDevTerminal: (nextTarget: { key: string; path: string } | null) => void;
};

export function ClonesSection({
    clones,
    actionError,
    onDismissActionError,
    startingDevKey,
    openingVSCodePath,
    devTerminalTarget,
    devTerminalSessions,
    onOpenInVSCode,
    onOpenDevTerminal,
    onToggleDevTerminal,
}: ClonesSectionProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Local clones</div>
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
                <div className="text-sm text-base-content/70">
                    No clones found in configured folders.
                </div>
            ) : (
                <div className="space-y-2">
                    {clones.map((clone) => (
                        <CloneCard
                            key={`clone:${clone.path}`}
                            clone={clone}
                            actionKey={`clone:${clone.path}`}
                            startingDevKey={startingDevKey}
                            openingVSCodePath={openingVSCodePath}
                            devTerminalTarget={devTerminalTarget}
                            devTerminalSessionId={devTerminalSessions[clone.path] ?? null}
                            onOpenInVSCode={onOpenInVSCode}
                            onOpenDevTerminal={onOpenDevTerminal}
                            onToggleDevTerminal={onToggleDevTerminal}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

type CloneCardProps = {
    clone: ProjectDetailsClone;
    actionKey: string;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    devTerminalTarget: { key: string; path: string } | null;
    devTerminalSessionId: string | null;
    onOpenInVSCode: (folderPath: string) => void;
    onOpenDevTerminal: (worktreePath: string, key: string) => void;
    onToggleDevTerminal: (nextTarget: { key: string; path: string } | null) => void;
};

function CloneCard({
    clone,
    actionKey,
    startingDevKey,
    openingVSCodePath,
    devTerminalTarget,
    devTerminalSessionId,
    onOpenInVSCode,
    onOpenDevTerminal,
    onToggleDevTerminal,
}: CloneCardProps) {
    const isStarting = startingDevKey === actionKey;
    const isOpeningVSCode = openingVSCodePath === clone.path;
    const devTerminalOpen = devTerminalTarget?.key === actionKey;
    const hasDevTerminalSession = Boolean(devTerminalSessionId);

    const terminalButtonLabel = isStarting
        ? "Opening"
        : devTerminalOpen
          ? "Hide terminal"
          : hasDevTerminalSession
            ? "Show terminal"
            : "Open terminal";

    return (
        <div className="space-y-2">
            <div className="p-3 border border-base-300 rounded-xl bg-base-100/60 flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <div className="font-mono text-xs break-all">{clone.path}</div>
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
                                {clone.prStatus.title ? ` — ${clone.prStatus.title}` : ""}
                            </a>
                        )}
                    {clone.commitHash && clone.commitDescription && (
                        <div className="text-xs text-base-content/70 break-all">
                            <span className="font-mono">{clone.commitHash.slice(0, 12)}</span>
                            <span className="mx-2">—</span>
                            <span>{clone.commitDescription}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
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
                        <div className="badge badge-success badge-outline">port {clone.port}</div>
                    )}

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
                                onToggleDevTerminal(null);
                                return;
                            }
                            if (hasDevTerminalSession) {
                                onToggleDevTerminal({ key: actionKey, path: clone.path });
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
                    <div className="p-3 border border-base-300 rounded-xl bg-base-200/50 space-y-1">
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
                    </div>
                )}
        </div>
    );
}
