import type { PreviewTarget } from "./types";

type LivePreviewSectionProps = {
    previewTargets: PreviewTarget[];
    activePreviewKey: string | null;
    previewUrl: string | null;
    onChangeActivePreviewKey: (key: string) => void;
};

export function LivePreviewSection({
    previewTargets,
    activePreviewKey,
    previewUrl,
    onChangeActivePreviewKey,
}: LivePreviewSectionProps) {
    if (previewTargets.length === 0 || !previewUrl) return null;

    return (
        <>
            <div className="divider my-0" />

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold">Live preview</div>
                        <div className="text-xs text-base-content/60 break-all">{previewUrl}</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            className="select select-bordered select-sm"
                            value={activePreviewKey ?? ""}
                            onChange={(event) => onChangeActivePreviewKey(event.target.value)}
                        >
                            {previewTargets.map((target) => (
                                <option key={target.key} value={target.key}>
                                    {target.label}
                                </option>
                            ))}
                        </select>
                        <a
                            className="btn btn-outline btn-sm"
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open
                        </a>
                    </div>
                </div>

                <div className="w-full h-[70vh] border border-base-300 rounded-xl overflow-hidden bg-base-100">
                    <iframe title="Project preview" src={previewUrl} className="w-full h-full" />
                </div>
            </div>
        </>
    );
}
