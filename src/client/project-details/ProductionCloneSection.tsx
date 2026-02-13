import { DevTerminalPanel } from "../DevTerminalPanel";
import type { ProjectDetailsPayload } from "./types";

type ProductionCloneSectionProps = {
    project: ProjectDetailsPayload;
    showProductionClone: boolean;
    previewProtocol: string;
    previewHost: string;
    startingDevKey: string | null;
    startingProduction: boolean;
    openingVSCodePath: string | null;
    updatingProductionMain: boolean;
    productionTerminalOpen: boolean;
    productionTerminalSessionId: string | null;
    onOpenProductionTerminal: (path: string) => void;
    onStartProductionServer: () => void;
    onUpdateProductionMain: () => void;
    onOpenInVSCode: (folderPath: string) => void;
    onToggleProductionTerminal: () => void;
};

export function ProductionCloneSection({
    project,
    showProductionClone,
    previewProtocol,
    previewHost,
    startingDevKey,
    startingProduction,
    openingVSCodePath,
    updatingProductionMain,
    productionTerminalOpen,
    productionTerminalSessionId,
    onOpenProductionTerminal,
    onStartProductionServer,
    onUpdateProductionMain,
    onOpenInVSCode,
    onToggleProductionTerminal,
}: ProductionCloneSectionProps) {
    if (!showProductionClone) return null;
    const productionMainStatus = project.productionClone?.mainBranchRemote;
    const showUpdateMainButton =
        productionMainStatus?.status === "behind" &&
        typeof productionMainStatus.behindCount === "number" &&
        productionMainStatus.behindCount > 0;

    return (
        <>
            <div className="divider my-0" />

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Production clone</div>
                    <span className="text-xs text-base-content/60">
                        {project.productionClone?.exists ? "ready" : "not cloned"}
                    </span>
                </div>

                <div className="p-3 border border-base-300 rounded-xl bg-base-100/60 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        {project.productionClone ? (
                            <>
                                <div className="font-mono text-xs break-all">
                                    {project.productionClone.path}
                                </div>
                                {project.productionClone.commitHash &&
                                    project.productionClone.commitDescription && (
                                        <div className="text-xs text-base-content/70 break-all">
                                            <span className="font-mono">
                                                {project.productionClone.commitHash.slice(0, 12)}
                                            </span>
                                            <span className="mx-2">—</span>
                                            <span>{project.productionClone.commitDescription}</span>
                                        </div>
                                    )}
                            </>
                        ) : (
                            <div className="text-sm text-base-content/70">
                                Production clone path will be created next to the clones folder.
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {project.productionClone && (
                            <div
                                className={`badge badge-outline whitespace-nowrap ${
                                    project.productionClone.inUse ? "badge-error" : "badge-ghost"
                                }`}
                            >
                                {project.productionClone.inUse ? "in use" : "idle"}
                            </div>
                        )}

                        {project.productionClone &&
                            typeof project.productionClone.hasChanges === "boolean" && (
                                <div
                                    className={`badge badge-outline ${
                                        project.productionClone.hasChanges
                                            ? "badge-warning"
                                            : "badge-success"
                                    }`}
                                >
                                    {project.productionClone.hasChanges ? "changes" : "clean"}
                                </div>
                            )}

                        {project.productionClone && (
                            <div className="badge badge-outline">
                                {project.productionClone.exists ? "production" : "missing"}
                            </div>
                        )}

                        {showUpdateMainButton && (
                            <div className="badge badge-warning badge-outline">
                                behind origin/main by {productionMainStatus.behindCount}
                            </div>
                        )}

                        {typeof project.productionClone?.port === "number" && (
                            <div className="badge badge-success badge-outline">
                                port {project.productionClone.port}
                            </div>
                        )}

                        {typeof project.productionClone?.port === "number" && (
                            <a
                                className="btn btn-outline btn-sm"
                                href={`${previewProtocol}://${previewHost}:${project.productionClone.port}/`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open
                            </a>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={
                                Boolean(startingDevKey) ||
                                startingProduction ||
                                updatingProductionMain
                            }
                            onClick={onStartProductionServer}
                        >
                            {startingProduction && (
                                <span className="loading loading-spinner loading-xs" />
                            )}
                            {startingProduction ? "Starting" : "Run production"}
                        </button>

                        {showUpdateMainButton && (
                            <button
                                type="button"
                                className="btn btn-warning btn-sm"
                                disabled={
                                    Boolean(startingDevKey) ||
                                    startingProduction ||
                                    updatingProductionMain
                                }
                                onClick={onUpdateProductionMain}
                            >
                                {updatingProductionMain && (
                                    <span className="loading loading-spinner loading-xs" />
                                )}
                                {updatingProductionMain ? "Updating" : "Update clone"}
                            </button>
                        )}

                        {project.productionClone?.path && (
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={Boolean(startingDevKey)}
                                onClick={() =>
                                    onOpenProductionTerminal(project.productionClone?.path ?? "")
                                }
                            >
                                {startingDevKey ===
                                    `production:${project.productionClone.path}` && (
                                    <span className="loading loading-spinner loading-xs" />
                                )}
                                {startingDevKey === `production:${project.productionClone.path}`
                                    ? "Opening"
                                    : "Open terminal"}
                            </button>
                        )}

                        {project.productionClone?.path && (
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={Boolean(openingVSCodePath)}
                                onClick={() => onOpenInVSCode(project.productionClone?.path ?? "")}
                            >
                                {openingVSCodePath === project.productionClone.path && (
                                    <span className="loading loading-spinner loading-xs" />
                                )}
                                {openingVSCodePath === project.productionClone.path
                                    ? "Opening"
                                    : "Open VSCode"}
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={onToggleProductionTerminal}
                        >
                            {productionTerminalOpen ? "Hide terminal" : "Show terminal"}
                        </button>
                    </div>
                </div>
            </div>

            {productionTerminalOpen && productionTerminalSessionId && (
                <DevTerminalPanel sessionId={productionTerminalSessionId} />
            )}
        </>
    );
}
