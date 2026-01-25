import type { RepositorySummary } from "./types/repositories";

type RepositoriesListProps = {
    repos: RepositorySummary[];
};

export function RepositoriesList({ repos }: RepositoriesListProps) {
    return (
        <div className="space-y-3">
            {repos.map((repo) => {
                return (
                    <div
                        key={repo.id}
                        className="p-4 border border-base-300 rounded-xl bg-base-100/60"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <a
                                    href={repo.url}
                                    className="font-semibold link link-hover"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {repo.name}
                                </a>
                                <p className="text-sm text-base-content/70 break-all">{repo.url}</p>
                            </div>
                            {repo.projectId && (
                                <span className="badge badge-outline text-xs">Linked</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default RepositoriesList;
