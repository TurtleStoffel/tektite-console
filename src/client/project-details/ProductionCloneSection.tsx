import { LogsPanel } from "../LogsPanel";

import type { LogsMeta, ProjectDetailsPayload } from "./types";

type ProductionCloneSectionProps = {
    project: ProjectDetailsPayload;
    showProductionClone: boolean;
    previewProtocol: string;
    previewHost: string;
    startingDevKey: string | null;
    startingProduction: boolean;
    openingVSCodePath: string | null;
    productionLogsOpen: boolean;
    productionLogs: string[] | null;
    productionLogsMeta: LogsMeta | null;
    onStartProductionServer: () => void;
    onOpenInVSCode: (folderPath: string) => void;
    onToggleProductionLogs: () => void;
    onRefreshProductionLogs: () => void;
};

export function ProductionCloneSection({
    project,
    showProductionClone,
    previewProtocol,
    previewHost,
    startingDevKey,
    startingProduction,
    openingVSCodePath,
    productionLogsOpen,
    productionLogs,
    productionLogsMeta,
    onStartProductionServer,
    onOpenInVSCode,
    onToggleProductionLogs,
    onRefreshProductionLogs,
}: ProductionCloneSectionProps) {
    if (!showProductionClone) return null;

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
                            disabled={Boolean(startingDevKey) || startingProduction}
                            onClick={onStartProductionServer}
                        >
                            {startingProduction && (
                                <span className="loading loading-spinner loading-xs" />
                            )}
                            {startingProduction ? "Starting" : "Run production"}
                        </button>

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
                            onClick={onToggleProductionLogs}
                        >
                            {productionLogsOpen ? "Hide logs" : "Show logs"}
                        </button>
                    </div>
                </div>
            </div>

            {productionLogsOpen && (
                <LogsPanel
                    title="Production logs"
                    logs={productionLogs}
                    emptyText="No logs yet. Click “Run production” to start and clone if needed."
                    onRefresh={onRefreshProductionLogs}
                    badges={
                        productionLogsMeta ? (
                            <>
                                <div className="badge badge-outline">
                                    {productionLogsMeta.exists ? "cloned" : "missing"}
                                </div>
                                {productionLogsMeta.installing && (
                                    <div className="badge badge-warning badge-outline">
                                        installing
                                    </div>
                                )}
                                {productionLogsMeta.running && (
                                    <div className="badge badge-success badge-outline">running</div>
                                )}
                            </>
                        ) : null
                    }
                />
            )}
        </>
    );
}
