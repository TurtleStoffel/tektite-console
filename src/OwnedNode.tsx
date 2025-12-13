import { useEffect, useMemo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useNavigate } from "react-router-dom";
import { Markdown } from "./Markdown";

type OwnedNodeData = {
    label?: string;
    ownerId?: string;
    displayOwnerType?: "project" | "idea" | null;
    displayOwnerUrl?: string | null;
    displayProjectName?: string | null;
    displayIdeaMarkdown?: string | null;
};

export function OwnedNode(props: NodeProps<OwnedNodeData>) {
    const { data, selected, type } = props;
    const navigate = useNavigate();

    const ownerType = data?.displayOwnerType ?? null;
    const ownerUrl = data?.displayOwnerUrl ?? null;
    const projectName = data?.displayProjectName ?? null;
    const ideaMarkdown = data?.displayIdeaMarkdown ?? null;
    const ownerId = typeof data?.ownerId === "string" ? data.ownerId : "";

    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const canViewDetails = ownerType === "project" && ownerId.length > 0;

    useEffect(() => {
        if (!menu) return;

        const handlePointerDown = () => setMenu(null);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenu(null);
        };

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [menu]);

    const menuStyle = useMemo(() => {
        if (!menu) return {};
        return {
            position: "fixed" as const,
            left: menu.x,
            top: menu.y,
            zIndex: 50,
        };
    }, [menu]);

    const borderClass =
        ownerType === "project"
            ? "border-primary/60"
            : ownerType === "idea"
              ? "border-secondary/60"
              : "border-base-300";

    const bgClass =
        ownerType === "project"
            ? "bg-primary/10"
            : ownerType === "idea"
              ? "bg-secondary/10"
              : "bg-base-100";

    return (
        <div
            onContextMenu={(event) => {
                if (!canViewDetails) return;
                event.preventDefault();
                event.stopPropagation();
                setMenu({ x: event.clientX, y: event.clientY });
            }}
            className={`w-full rounded-xl border shadow-sm px-3 py-2 ${borderClass} ${bgClass} ${
                selected ? "ring-2 ring-primary/40" : ""
            }`}
        >
            {type !== "input" && <Handle type="target" position={Position.Top} />}
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{data?.label ?? "Node"}</div>
                    {ownerType && <div className="badge badge-outline capitalize">{ownerType}</div>}
                </div>
                {ownerType === "project" && projectName && (
                    <div className="text-xs text-base-content/70 break-words">{projectName}</div>
                )}
                {ownerType === "project" && ownerUrl && (
                    <a
                        href={ownerUrl}
                        className="link link-hover text-xs break-all"
                        target="_blank"
                        rel="noreferrer"
                    >
                        {ownerUrl}
                    </a>
                )}
                {ownerType === "idea" && ideaMarkdown && (
                    <Markdown markdown={ideaMarkdown} className="text-xs text-base-content/80 space-y-1" />
                )}
                {!data?.ownerId && <div className="text-xs text-base-content/50">No owner assigned.</div>}
            </div>
            {type !== "output" && <Handle type="source" position={Position.Bottom} />}
            {menu && (
                <div
                    style={menuStyle}
                    className="card bg-base-100 border border-base-300 shadow-xl min-w-44"
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                    }}
                >
                    <ul className="menu menu-sm p-2">
                        <li>
                            <button
                                type="button"
                                onClick={() => {
                                    setMenu(null);
                                    navigate(`/projects/${ownerId}`);
                                }}
                            >
                                View details
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}
