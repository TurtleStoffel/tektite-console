import { Handle, Position, type NodeProps } from "reactflow";
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

    const ownerType = data?.displayOwnerType ?? null;
    const ownerUrl = data?.displayOwnerUrl ?? null;
    const projectName = data?.displayProjectName ?? null;
    const ideaMarkdown = data?.displayIdeaMarkdown ?? null;

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
        </div>
    );
}
