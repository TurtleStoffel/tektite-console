import { CloneCard } from "./ClonesSection";
import { LivePreviewSection } from "./LivePreviewSection";
import type { PreviewTarget, ProjectDetailsClone } from "./types";

type WorktreeSelectorProps = {
    worktrees: ProjectDetailsClone[];
    selectedWorktreePath: string | null;
    onSelectWorktree: (worktreePath: string) => void;
    onClearSelection: () => void;
};

export function WorktreeSelector({
    worktrees,
    selectedWorktreePath,
    onSelectWorktree,
    onClearSelection,
}: WorktreeSelectorProps) {
    return (
        <div className="space-y-4 xl:sticky xl:top-6 self-start">
            <div className="card bg-base-200 border border-base-300 shadow-sm">
                <div className="card-body p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">Worktrees</div>
                        <div className="text-xs text-base-content/60">{worktrees.length}</div>
                    </div>
                    {worktrees.length === 0 ? (
                        <div className="text-sm text-base-content/70">
                            No worktrees found for this project.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                            {worktrees.map((worktree) => {
                                const isSelected = selectedWorktreePath === worktree.path;
                                return (
                                    <button
                                        key={worktree.path}
                                        type="button"
                                        className={`w-full text-left rounded-xl border p-3 transition-colors ${
                                            isSelected
                                                ? "border-primary bg-primary/10"
                                                : "border-base-300 bg-base-100 hover:border-primary/40"
                                        }`}
                                        onClick={() => onSelectWorktree(worktree.path)}
                                    >
                                        <div className="font-mono text-xs break-all">
                                            {worktree.path}
                                        </div>
                                        {worktree.promptSummary && (
                                            <div className="mt-1 text-xs text-base-content/80 break-words">
                                                Task summary: {worktree.promptSummary}
                                            </div>
                                        )}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <div
                                                className={`badge badge-outline ${
                                                    worktree.inUse ? "badge-error" : "badge-ghost"
                                                }`}
                                            >
                                                {worktree.inUse ? "in use" : "idle"}
                                            </div>
                                            {typeof worktree.port === "number" && (
                                                <div className="badge badge-success badge-outline">
                                                    port {worktree.port}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {selectedWorktreePath && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={onClearSelection}
                        >
                            Close worktree details
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

type SelectedWorktreeDetailsProps = {
    selectedWorktree: ProjectDetailsClone;
    selectedWorktreePreviewTargets: PreviewTarget[];
    activePreviewKey: string | null;
    previewUrl: string | null;
    startingDevKey: string | null;
    openingVSCodePath: string | null;
    devTerminalOpen: boolean;
    devTerminalSessionId: string | null;
    onOpenInVSCode: (path: string) => void;
    onOpenDevTerminal: (path: string, key: string) => void;
    onToggleDevTerminal: (worktreePath: string, isOpen: boolean) => void;
    onResumeCodexThread: (worktreePath: string, threadId: string, comment: string) => Promise<void>;
    onChangeActivePreviewKey: (key: string) => void;
};

export function SelectedWorktreeDetails({
    selectedWorktree,
    selectedWorktreePreviewTargets,
    activePreviewKey,
    previewUrl,
    startingDevKey,
    openingVSCodePath,
    devTerminalOpen,
    devTerminalSessionId,
    onOpenInVSCode,
    onOpenDevTerminal,
    onToggleDevTerminal,
    onResumeCodexThread,
    onChangeActivePreviewKey,
}: SelectedWorktreeDetailsProps) {
    return (
        <section className="space-y-3">
            <div>
                <div className="text-sm font-semibold">Worktree details</div>
                <div className="text-xs text-base-content/60">
                    Selected worktree information and actions
                </div>
            </div>
            <CloneCard
                clone={selectedWorktree}
                actionKey={`clone:${selectedWorktree.path}`}
                startingDevKey={startingDevKey}
                openingVSCodePath={openingVSCodePath}
                devTerminalOpen={devTerminalOpen}
                devTerminalSessionId={devTerminalSessionId}
                onOpenInVSCode={onOpenInVSCode}
                onOpenDevTerminal={onOpenDevTerminal}
                onToggleDevTerminal={onToggleDevTerminal}
                onResumeCodexThread={onResumeCodexThread}
            />
            <LivePreviewSection
                previewTargets={selectedWorktreePreviewTargets}
                activePreviewKey={activePreviewKey}
                previewUrl={previewUrl}
                onChangeActivePreviewKey={onChangeActivePreviewKey}
            />
        </section>
    );
}
