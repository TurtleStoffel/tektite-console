import type { CSSProperties } from "react";

type ProjectNodeProps = {
    id: string;
    label: string;
    width: number;
    height: number;
    x: number;
    y: number;
    isSelected: boolean;
    isConnectSource: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export default function ProjectNode({
    id,
    label,
    width,
    height,
    x,
    y,
    isSelected,
    isConnectSource,
    onPointerDown,
}: ProjectNodeProps) {
    const style: CSSProperties = { width, height, left: x, top: y };

    return (
        <div
            className={`absolute rounded-xl border px-3 py-2 shadow-md select-none ${
                isSelected ? "border-primary bg-primary/15" : "border-primary/50 bg-primary/5"
            } ${isConnectSource ? "ring-2 ring-secondary ring-offset-2 ring-offset-base-100" : ""}`}
            style={style}
            onPointerDown={onPointerDown}
        >
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-xs text-base-content/60">{id.slice(0, 8)}</div>
        </div>
    );
}
