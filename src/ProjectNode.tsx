import { Handle, type NodeProps, Position } from "reactflow";

type ProjectNodeData = {
    label?: string;
    projectId?: string;
    displayProjectName?: string | null;
};

export function ProjectNode(props: NodeProps<ProjectNodeData>) {
    const { data, selected, type } = props;
    const projectName = data?.displayProjectName ?? null;
    const hasProject = Boolean(data?.projectId);

    const borderClass = hasProject ? "border-primary/60" : "border-base-300";
    const bgClass = hasProject ? "bg-primary/10" : "bg-base-100";

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
                    {hasProject && <div className="badge badge-outline">Project</div>}
                </div>
                {projectName && (
                    <div className="text-xs text-base-content/70 break-words">{projectName}</div>
                )}
                {!hasProject && (
                    <div className="text-xs text-base-content/50">No project assigned.</div>
                )}
            </div>
            {type !== "output" && <Handle type="source" position={Position.Bottom} />}
        </div>
    );
}
