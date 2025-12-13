import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type ProjectDetailsProps = {
    drawerToggleId: string;
};

type ProjectDetailsPayload = {
    id: string;
    name: string;
    url: string;
    nodeCount: number;
    flowCount: number;
    clones?: Array<{ path: string; location: "clonesDir" | "codingFolder" }>;
};

export function ProjectDetails({ drawerToggleId }: ProjectDetailsProps) {
    const { id } = useParams();
    const [project, setProject] = useState<ProjectDetailsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        let active = true;
        const load = async () => {
            setLoading(true);
            setError(null);
            setProject(null);
            try {
                const res = await fetch(`/api/projects/${id}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(payload?.error || "Project not found.");
                }
                if (!active) return;
                setProject(payload as ProjectDetailsPayload);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load project.";
                if (!active) return;
                setError(message);
            } finally {
                if (!active) return;
                setLoading(false);
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [id]);

    return (
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Project details</h1>
                    <p className="text-sm text-base-content/70 break-all">{id}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/editor" className="btn btn-outline btn-sm">
                        Back to editor
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-base-content/70">
                    <span className="loading loading-spinner loading-sm" />
                    <span>Loading project&hellip;</span>
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && project && (
                <div className="card bg-base-200 border border-base-300 shadow-md">
                    <div className="card-body space-y-4">
                        <div className="space-y-1">
                            <div className="text-sm text-base-content/60">Name</div>
                            <div className="text-xl font-semibold">{project.name}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-sm text-base-content/60">Repository</div>
                            <a href={project.url} className="link link-hover break-all" target="_blank" rel="noreferrer">
                                {project.url}
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="badge badge-outline">{project.nodeCount} nodes</div>
                            <div className="badge badge-outline">{project.flowCount} flows</div>
                        </div>

                        <div className="divider my-0" />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Local clones</div>
                                <span className="text-xs text-base-content/60">{project.clones?.length ?? 0}</span>
                            </div>
                            {!project.clones || project.clones.length === 0 ? (
                                <div className="text-sm text-base-content/70">No clones found in configured folders.</div>
                            ) : (
                                <div className="space-y-2">
                                    {project.clones.map((clone) => (
                                        <div
                                            key={`${clone.location}:${clone.path}`}
                                            className="p-3 border border-base-300 rounded-xl bg-base-100/60 flex items-center justify-between gap-3"
                                        >
                                            <div className="font-mono text-xs break-all">{clone.path}</div>
                                            <div className="badge badge-outline">{clone.location}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectDetails;
