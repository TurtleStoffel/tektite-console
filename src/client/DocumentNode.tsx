import type { CSSProperties } from "react";

type DocumentNodeProps = {
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

export default function DocumentNode({
    id,
    label,
    width,
    height,
    x,
    y,
    isSelected,
    isConnectSource,
    onPointerDown,
}: DocumentNodeProps) {
    const style: CSSProperties = { width, height, left: x, top: y };

    return (
        <div
            className={`absolute rounded-xl border px-3 py-2 shadow-md select-none ${
                isSelected ? "border-info bg-info/10" : "border-base-300 bg-base-200"
            } ${isConnectSource ? "ring-2 ring-info ring-offset-2 ring-offset-base-100" : ""}`}
            style={style}
            onPointerDown={onPointerDown}
        >
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-xs text-base-content/60">Doc {id.slice(0, 8)}</div>
        </div>
    );
}
