import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { CanvasPage } from "./CanvasPage";
import { DependenciesPage } from "./DependenciesPage";
import { DocumentsPage } from "./DocumentsPage";
import { EnvIndicator } from "./EnvIndicator";
import { ProjectDetails } from "./ProjectDetails";
import { ProjectsPage } from "./ProjectsPage";
import { RepositoriesPage } from "./RepositoriesPage";
import { TasksPage } from "./TasksPage";
import "./index.css";

export function App() {
    const entityDrawerId = "entities-drawer";
    const navItemClassName = "btn btn-sm btn-ghost text-base-content/70 hover:text-base-content";

    const navLinks = [
        { to: "/", label: "Projects" },
        { to: "/repositories", label: "Repositories" },
        { to: "/documents", label: "Documents" },
        { to: "/tasks", label: "Tasks" },
        { to: "/canvas", label: "Canvas" },
        { to: "/dependencies", label: "Dependencies" },
    ];

    return (
        <div className="drawer drawer-end">
            <input id={entityDrawerId} type="checkbox" className="drawer-toggle" />
            <div className="drawer-content">
                <header className="sticky top-0 z-50 border-b border-base-300 bg-base-200">
                    <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                            <span className="text-sm font-semibold uppercase tracking-wide text-base-content/80">
                                Tektite
                            </span>
                            {navLinks.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === "/"}
                                    className={({ isActive }) =>
                                        `${navItemClassName} ${isActive ? "btn-active text-base-content" : ""}`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <EnvIndicator />
                        </div>
                    </div>
                </header>
                <Routes>
                    <Route path="/" element={<ProjectsPage drawerToggleId={entityDrawerId} />} />
                    <Route
                        path="/repositories"
                        element={<RepositoriesPage drawerToggleId={entityDrawerId} />}
                    />
                    <Route
                        path="/documents"
                        element={<DocumentsPage drawerToggleId={entityDrawerId} />}
                    />
                    <Route path="/tasks" element={<TasksPage drawerToggleId={entityDrawerId} />} />
                    <Route
                        path="/canvas"
                        element={<CanvasPage drawerToggleId={entityDrawerId} />}
                    />
                    <Route
                        path="/dependencies"
                        element={<DependenciesPage drawerToggleId={entityDrawerId} />}
                    />
                    <Route
                        path="/projects/:id"
                        element={<ProjectDetails drawerToggleId={entityDrawerId} />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
            <div className="drawer-side">
                <label
                    htmlFor={entityDrawerId}
                    className="drawer-overlay"
                    aria-label="close entities drawer"
                />
                <aside className="w-64 min-h-full bg-base-200 border-l border-base-300 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm uppercase tracking-wide text-base-content/60">
                            Entities
                        </h2>
                        <label htmlFor={entityDrawerId} className="btn btn-ghost btn-xs">
                            Close
                        </label>
                    </div>
                    <ul className="menu p-0">
                        {navLinks.map((item) => (
                            <li key={item.to}>
                                <Link to={item.to}>{item.label}</Link>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </div>
    );
}
