import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { RepositorySummary } from "./types/repositories";
import { getErrorMessage } from "./utils/errors";

type MainContentProps = {
    drawerToggleId: string;
};

type ProjectSummary = {
    id: string;
    name: string | null;
    url: string | null;
};

export function MainContent({ drawerToggleId }: MainContentProps) {
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectRepositoryId, setNewProjectRepositoryId] = useState("");
    const queryClient = useQueryClient();

    const fetchProjects = useCallback(async () => {
        console.info("[projects] loading project list...");
        const res = await fetch("/api/projects");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load projects.");
        }
        const list = Array.isArray(payload?.projects) ? (payload.projects as ProjectSummary[]) : [];
        console.info(`[projects] loaded ${list.length} projects.`);
        return list;
    }, []);

    const {
        data: projects = [],
        isLoading,
        isFetching,
        error: projectsErrorRaw,
        refetch: refetchProjects,
    } = useQuery<ProjectSummary[]>({
        queryKey: ["projects"],
        queryFn: fetchProjects,
    });

    const fetchRepositories = useCallback(async () => {
        console.info("[repositories] loading repositories from local DB...");
        const res = await fetch("/api/repositories");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load repositories.");
        }
        const list = Array.isArray(payload?.repositories)
            ? (payload.repositories as RepositorySummary[])
            : [];
        console.info(`[repositories] loaded ${list.length} repositories.`);
        return list;
    }, []);

    const {
        data: repositories = [],
        isLoading: repositoriesLoading,
        error: repositoriesErrorRaw,
    } = useQuery<RepositorySummary[]>({
        queryKey: ["repositories"],
        queryFn: fetchRepositories,
    });

    const availableRepositories = useMemo(
        () => repositories.filter((repo) => !repo.projectId),
        [repositories],
    );

    const createProjectMutation = useMutation({
        mutationFn: async ({
            name,
            repositoryId,
        }: {
            name: string;
            repositoryId: string;
        }) => {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, repositoryId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create project.");
            }
            return payload as { id: string; name: string; url: string };
        },
        onSuccess: async () => {
            setNewProjectName("");
            setNewProjectRepositoryId("");
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    const handleCreateProject = useCallback(() => {
        const name = newProjectName.trim();
        const repositoryId = newProjectRepositoryId.trim();
        if (!name || !repositoryId) return;
        createProjectMutation.mutate({ name, repositoryId });
    }, [createProjectMutation, newProjectName, newProjectRepositoryId]);

    const projectsError = getErrorMessage(projectsErrorRaw);
    const repositoriesError = getErrorMessage(repositoriesErrorRaw);
    const createError = getErrorMessage(createProjectMutation.error);
    const isCreating = createProjectMutation.isPending;

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <div className="flex items-center justify-between">
                <header className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Projects</h1>
                    <p className="text-base-content/80">Select a project to view details.</p>
                </header>
                <div className="flex items-center gap-2">
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
                                Select a repository to track the new project.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => void refetchProjects()}
                            disabled={isFetching}
                        >
                            Refresh list
                        </button>
                    </div>
                    {createError && (
                        <div className="alert alert-error">
                            <span>{createError}</span>
                        </div>
                    )}
                    {repositoriesError && (
                        <div className="alert alert-error">
                            <span>{repositoriesError}</span>
                        </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                        <input
                            className="input input-bordered w-full"
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={(event) => setNewProjectName(event.target.value)}
                        />
                        <select
                            className="select select-bordered w-full"
                            value={newProjectRepositoryId}
                            onChange={(event) => setNewProjectRepositoryId(event.target.value)}
                            disabled={repositoriesLoading || availableRepositories.length === 0}
                        >
                            <option value="">
                                {repositoriesLoading
                                    ? "Loading repositories..."
                                    : availableRepositories.length === 0
                                      ? "No unlinked repositories"
                                      : "Select repository"}
                            </option>
                            {availableRepositories.map((repo) => (
                                <option key={repo.id} value={repo.id}>
                                    {repo.name} — {repo.url}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-base-content/60">
                            {projects.length} total projects
                        </span>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleCreateProject}
                            disabled={
                                isCreating ||
                                !newProjectName.trim() ||
                                !newProjectRepositoryId.trim()
                            }
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
                            Create your first project using the form above.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 text-left">
                    {projects.map((project: ProjectSummary) => {
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
