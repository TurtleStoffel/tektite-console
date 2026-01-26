import { useCallback, useEffect, useState } from "react";
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
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectUrl, setNewProjectUrl] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const loadProjects = useCallback(async (shouldSetLoading = true) => {
        if (shouldSetLoading) {
            setIsLoading(true);
        }
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
            setProjects(list);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load projects.";
            setProjectsError(message);
        } finally {
            if (shouldSetLoading) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadProjects(true);
    }, [loadProjects]);

    const handleCreateProject = useCallback(async () => {
        const name = newProjectName.trim();
        const url = newProjectUrl.trim();
        if (!name || !url) return;
        setCreateError(null);
        setIsCreating(true);
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, url }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || "Failed to create project.");
            }
            setNewProjectName("");
            setNewProjectUrl("");
            await loadProjects(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create project.";
            setCreateError(message);
        } finally {
            setIsCreating(false);
        }
    }, [newProjectName, newProjectUrl, loadProjects]);

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

            {projectsError && (
                <div className="alert alert-error text-left">
                    <span>{projectsError}</span>
                </div>
            )}

            <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                <div className="card-body space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="card-title">New project</h2>
                            <p className="text-sm text-base-content/70">
                                Add a repository URL to track the new project.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => loadProjects(false)}
                        >
                            Refresh list
                        </button>
                    </div>
                    {createError && (
                        <div className="alert alert-error">
                            <span>{createError}</span>
                        </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                        <input
                            className="input input-bordered w-full"
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={(event) => setNewProjectName(event.target.value)}
                        />
                        <input
                            className="input input-bordered w-full"
                            placeholder="Repository URL"
                            value={newProjectUrl}
                            onChange={(event) => setNewProjectUrl(event.target.value)}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-base-content/60">
                            {projects.length} total projects
                        </span>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleCreateProject}
                            disabled={isCreating || !newProjectName.trim() || !newProjectUrl.trim()}
                        >
                            {isCreating ? "Creating…" : "Create project"}
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
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

            <GithubRepoCard />
        </div>
    );
}

export default MainContent;
