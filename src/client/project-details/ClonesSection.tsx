import { DevTerminalPanel } from "../DevTerminalPanel";
import { LogsPanel } from "../LogsPanel";

import { prBadgeClass, prBadgeLabel } from "./helpers";
import type { LogsMeta, ProjectDetailsClone } from "./types";

type ClonesSectionProps = {
    clones: ProjectDetailsClone[] | undefined;
    actionError: string | null;
    onDismissActionError: () => void;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    updatingCloneKey: string | null;
    devLogsTarget: { key: string; path: string } | null;
    devLogs: string[] | null;
    devLogsMeta: LogsMeta | null;
    devServerMode: "logs" | "terminal";
    onChangeDevServerMode: (mode: "logs" | "terminal") => void;
    devTerminalSessions: Record<string, string | null>;
    onOpenInVSCode: (folderPath: string) => void;
    onStartDevServer: (worktreePath: string, key: string) => void;
    onUpdateClone: (worktreePath: string) => void;
    onRefreshDevLogs: (worktreePath: string) => void;
    onToggleDevLogs: (nextTarget: { key: string; path: string } | null) => void;
    onClearDevLogs: () => void;
};

export function ClonesSection({
    clones,
    actionError,
    onDismissActionError,
    startingDevKey,
    openingVSCodePath,
    updatingCloneKey,
    devLogsTarget,
    devLogs,
    devLogsMeta,
    devServerMode,
    onChangeDevServerMode,
    devTerminalSessions,
    onOpenInVSCode,
    onStartDevServer,
    onUpdateClone,
    onRefreshDevLogs,
    onToggleDevLogs,
    onClearDevLogs,
}: ClonesSectionProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Local clones</div>
                <div className="flex items-center gap-2">
                    <select
                        className="select select-bordered select-xs"
                        value={devServerMode}
                        onChange={(event) =>
                            onChangeDevServerMode(event.target.value as "logs" | "terminal")
                        }
                    >
                        <option value="logs">Classic logs</option>
                        <option value="terminal">Interactive terminal</option>
                    </select>
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
                            updatingCloneKey={updatingCloneKey}
                            devLogsTarget={devLogsTarget}
                            devLogs={devLogs}
                            devLogsMeta={devLogsMeta}
                            devServerMode={devServerMode}
                            devTerminalSessionId={devTerminalSessions[clone.path] ?? null}
                            onOpenInVSCode={onOpenInVSCode}
                            onStartDevServer={onStartDevServer}
                            onUpdateClone={onUpdateClone}
                            onRefreshDevLogs={onRefreshDevLogs}
                            onToggleDevLogs={onToggleDevLogs}
                            onClearDevLogs={onClearDevLogs}
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
    updatingCloneKey: string | null;
    devLogsTarget: { key: string; path: string } | null;
    devLogs: string[] | null;
    devLogsMeta: LogsMeta | null;
    devServerMode: "logs" | "terminal";
    devTerminalSessionId: string | null;
    onOpenInVSCode: (folderPath: string) => void;
    onStartDevServer: (worktreePath: string, key: string) => void;
    onUpdateClone: (worktreePath: string) => void;
    onRefreshDevLogs: (worktreePath: string) => void;
    onToggleDevLogs: (nextTarget: { key: string; path: string } | null) => void;
    onClearDevLogs: () => void;
};

function CloneCard({
    clone,
    actionKey,
    startingDevKey,
    openingVSCodePath,
    updatingCloneKey,
    devLogsTarget,
    devLogs,
    devLogsMeta,
    devServerMode,
    devTerminalSessionId,
    onOpenInVSCode,
    onStartDevServer,
    onUpdateClone,
    onRefreshDevLogs,
    onToggleDevLogs,
    onClearDevLogs,
}: CloneCardProps) {
    const showRunDev = Boolean(clone.isWorktree) && !clone.inUse && typeof clone.port !== "number";
    const isStarting = startingDevKey === actionKey;
    const isOpeningVSCode = openingVSCodePath === clone.path;
    const isUpdatingClone = updatingCloneKey === actionKey;
    const devLogsOpen = devLogsTarget?.key === actionKey;
    const showUpdateClone = clone.updateFromOriginMain?.eligible === true;

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

                    {clone.isWorktree && (
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                                if (devLogsOpen) {
                                    onToggleDevLogs(null);
                                    return;
                                }
                                onToggleDevLogs({ key: actionKey, path: clone.path });
                                onClearDevLogs();
                            }}
                        >
                            {devLogsOpen
                                ? devServerMode === "terminal"
                                    ? "Hide terminal"
                                    : "Hide logs"
                                : devServerMode === "terminal"
                                  ? "Show terminal"
                                  : "Show logs"}
                        </button>
                    )}

                    {showRunDev && (
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={Boolean(startingDevKey)}
                            onClick={() => onStartDevServer(clone.path, actionKey)}
                        >
                            {isStarting && <span className="loading loading-spinner loading-xs" />}
                            {isStarting ? "Starting" : "Run dev"}
                        </button>
                    )}

                    {showUpdateClone && (
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={Boolean(updatingCloneKey)}
                            onClick={() => onUpdateClone(clone.path)}
                        >
                            {isUpdatingClone && (
                                <span className="loading loading-spinner loading-xs" />
                            )}
                            {isUpdatingClone
                                ? "Updating"
                                : `Update (${clone.updateFromOriginMain?.behindCount ?? 0})`}
                        </button>
                    )}
                </div>
            </div>

            {devLogsOpen &&
                (devServerMode === "terminal" && devTerminalSessionId ? (
                    <DevTerminalPanel sessionId={devTerminalSessionId} />
                ) : (
                    <LogsPanel
                        title="Dev logs"
                        logs={devLogs}
                        emptyText="No logs yet. Click “Run dev” to start."
                        onRefresh={() => onRefreshDevLogs(clone.path)}
                        badges={
                            devLogsMeta ? (
                                <>
                                    <div className="badge badge-outline">
                                        {devLogsMeta.exists ? "worktree" : "missing"}
                                    </div>
                                    {devLogsMeta.installing && (
                                        <div className="badge badge-warning badge-outline">
                                            installing
                                        </div>
                                    )}
                                    {devLogsMeta.running && (
                                        <div className="badge badge-success badge-outline">
                                            running
                                        </div>
                                    )}
                                </>
                            ) : null
                        }
                    />
                ))}
        </div>
    );
}
