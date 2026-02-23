import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage } from "./utils/errors";

type ProjectsPageProps = {
    drawerToggleId: string;
};

type ProjectSummary = {
    id: string;
    name: string | null;
    url: string | null;
    sortOrder: number;
};

const SORT_ORDER_GAP = 1024;

function getSortOrderForMove(options: {
    list: { sortOrder: number }[];
    currentIndex: number;
    targetIndex: number;
}) {
    const listWithoutCurrent = options.list.filter((_, index) => index !== options.currentIndex);
    const insertIndex =
        options.targetIndex > options.currentIndex ? options.targetIndex - 1 : options.targetIndex;
    const before = listWithoutCurrent[insertIndex - 1] ?? null;
    const after = listWithoutCurrent[insertIndex] ?? null;

    if (before && after) {
        return Math.floor((before.sortOrder + after.sortOrder) / 2);
    }
    if (!before && after) {
        return after.sortOrder - SORT_ORDER_GAP;
    }
    if (before && !after) {
        return before.sortOrder + SORT_ORDER_GAP;
    }

    return options.list[options.currentIndex]?.sortOrder ?? 0;
}

export function ProjectsPage({ drawerToggleId }: ProjectsPageProps) {
    const [newProjectName, setNewProjectName] = useState("");
    const queryClient = useQueryClient();

    const fetchProjects = useCallback(async () => {
        console.info("[projects] loading project list...");
        const res = await fetch("/api/projects");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load projects.");
        }
        const list = Array.isArray(payload?.data) ? (payload.data as ProjectSummary[]) : [];
        console.info(`[projects] loaded ${list.length} projects.`);
        return list;
    }, []);

    const {
        data: projects = [],
        isLoading,
        error: projectsErrorRaw,
    } = useQuery<ProjectSummary[]>({
        queryKey: ["projects"],
        queryFn: fetchProjects,
    });

    const createProjectMutation = useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const response = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(response?.error || "Failed to create project.");
            }
            return response as { id: string; name: string; url: string | null };
        },
        onSuccess: async () => {
            setNewProjectName("");
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    const reorderProjectsMutation = useMutation({
        mutationFn: async (input: { projectId: string; sortOrder: number }) => {
            const response = await fetch("/api/projects/order", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || "Failed to reorder projects.");
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    const handleCreateProject = useCallback(() => {
        const name = newProjectName.trim();
        if (!name) return;
        createProjectMutation.mutate({ name });
    }, [createProjectMutation, newProjectName]);

    const handleMoveProject = useCallback(
        (projectId: string, direction: "up" | "down") => {
            const currentIndex = projects.findIndex((project) => project.id === projectId);
            if (currentIndex < 0) {
                throw new Error("Project to reorder was not found in list.");
            }

            const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= projects.length) {
                return;
            }

            const sortOrder = getSortOrderForMove({
                list: projects,
                currentIndex,
                targetIndex,
            });
            reorderProjectsMutation.mutate({ projectId, sortOrder });
        },
        [projects, reorderProjectsMutation],
    );

    const projectsError = getErrorMessage(projectsErrorRaw);
    const createError = getErrorMessage(createProjectMutation.error);
    const reorderError = getErrorMessage(reorderProjectsMutation.error);
    const isCreating = createProjectMutation.isPending;
    const isReordering = reorderProjectsMutation.isPending;

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
            {reorderError && (
                <div className="alert alert-error text-left">
                    <span>{reorderError}</span>
                </div>
            )}

            <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                <div className="card-body space-y-4">
                    <div className="space-y-1">
                        <div className="space-y-1">
                            <h2 className="card-title">New project</h2>
                        </div>
                    </div>
                    {createError && (
                        <div className="alert alert-error">
                            <span>{createError}</span>
                        </div>
                    )}
                    <input
                        className="input input-bordered w-full"
                        placeholder="Project name"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                    />
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-base-content/60">
                            {projects.length} total projects
                        </span>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleCreateProject}
                            disabled={isCreating || !newProjectName.trim()}
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
                    {projects.map((project: ProjectSummary, index) => {
                        const name = project.name?.trim() || "Untitled";
                        return (
                            <div
                                key={project.id}
                                className="card bg-base-200 border border-base-300 shadow-md"
                            >
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-3">
                                        <Link
                                            to={`/projects/${project.id}`}
                                            className="card-title truncate hover:underline"
                                        >
                                            {name}
                                        </Link>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                disabled={isReordering || index === 0}
                                                onClick={() => handleMoveProject(project.id, "up")}
                                            >
                                                Up
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                disabled={
                                                    isReordering || index === projects.length - 1
                                                }
                                                onClick={() =>
                                                    handleMoveProject(project.id, "down")
                                                }
                                            >
                                                Down
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
