import type { ReactNode } from "react";

type LogsPanelProps = {
    title: string;
    badges?: ReactNode;
    logs: string[] | null;
    onRefresh: () => void;
    emptyText: string;
    loadingText?: string;
};

export function LogsPanel({
    title,
    badges,
    logs,
    onRefresh,
    emptyText,
    loadingText = "Loading logs…",
}: LogsPanelProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{title}</div>
                    {badges}
                </div>
                <button type="button" className="btn btn-ghost btn-xs" onClick={onRefresh}>
                    Refresh
                </button>
            </div>
            <div className="border border-base-300 rounded-xl bg-base-100 p-3 max-h-80 overflow-auto">
                {logs && logs.length > 0 ? (
                    <pre className="text-xs whitespace-pre-wrap break-words">{logs.join("\n")}</pre>
                ) : (
                    <div className="text-sm text-base-content/70">
                        {logs === null ? loadingText : emptyText}
                    </div>
                )}
            </div>
        </div>
    );
}
