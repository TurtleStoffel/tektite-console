import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GithubRepoCard from "./GithubRepoCard";

type MainContentProps = {
    drawerToggleId: string;
};

type ProjectSummary = {
    id: string;
    name: string | null;
    url: string | null;
};

export function MainContent({ drawerToggleId }: MainContentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadProjects = async () => {
            setIsLoading(true);
            setProjectsError(null);
            try {
                const res = await fetch("/api/projects");
                const payload = await res.json().catch(() => ({}));
                const list = Array.isArray(payload?.projects)
                    ? (payload.projects as ProjectSummary[])
                    : [];
                if (!res.ok) {
                    throw new Error(payload?.error || "Failed to load projects.");
                }
                if (cancelled) return;
                setProjects(list);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load projects.";
                if (cancelled) return;
                setProjectsError(message);
            } finally {
                if (cancelled) return;
                setIsLoading(false);
            }
        };

        void loadProjects();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <div className="flex items-center justify-between">
                <header className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Projects</h1>
                    <p className="text-base-content/80">Select a project to view details.</p>
                </header>
                <div className="flex items-center gap-2">
                    <Link to="/editor" className="btn btn-primary btn-sm">
                        Node editor
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <GithubRepoCard />

            {projectsError ? (
                <div className="alert alert-error text-left">
                    <span>{projectsError}</span>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            ) : projects.length === 0 ? (
                <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                    <div className="card-body">
                        <h2 className="card-title">No projects yet</h2>
                        <p className="text-base-content/70">
                            Create your first project in the Node editor.
                        </p>
                        <div className="card-actions justify-end">
                            <Link to="/editor" className="btn btn-primary btn-sm">
                                Open Node editor
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 text-left">
                    {projects.map((project) => {
                        const name = project.name?.trim() || "Untitled";
                        return (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="card bg-base-200 border border-base-300 shadow-md hover:shadow-lg transition-shadow"
                            >
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-4">
                                        <h2 className="card-title truncate">{name}</h2>
                                        <div className="btn btn-outline btn-sm">View</div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MainContent;
