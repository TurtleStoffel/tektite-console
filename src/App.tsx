import { Link, Navigate, Route, Routes } from "react-router-dom";
import CommandPanel from "./CommandPanel";
import DocumentsPage from "./DocumentsPage";
import Drawer from "./Drawer";
import EnvIndicator from "./EnvIndicator";
import MainContent from "./MainContent";
import ProjectDetails from "./ProjectDetails";
import RepositoriesPage from "./RepositoriesPage";
import "./index.css";

export function App() {
    const entityDrawerId = "entities-drawer";

    return (
        <Drawer side={<CommandPanel />}>
            {(drawerToggleId) => (
                <div className="drawer drawer-end">
                    <input id={entityDrawerId} type="checkbox" className="drawer-toggle" />
                    <div className="drawer-content">
                        <EnvIndicator />
                        <label
                            htmlFor={entityDrawerId}
                            className="btn btn-ghost btn-square fixed top-6 right-6 z-50"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </label>
                        <Routes>
                            <Route
                                path="/"
                                element={<MainContent drawerToggleId={drawerToggleId} />}
                            />
                            <Route
                                path="/repositories"
                                element={<RepositoriesPage drawerToggleId={drawerToggleId} />}
                            />
                            <Route
                                path="/documents"
                                element={<DocumentsPage drawerToggleId={drawerToggleId} />}
                            />
                            <Route
                                path="/projects/:id"
                                element={<ProjectDetails drawerToggleId={drawerToggleId} />}
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
                                <li>
                                    <Link to="/">Projects</Link>
                                </li>
                                <li>
                                    <Link to="/repositories">Repositories</Link>
                                </li>
                                <li>
                                    <Link to="/documents">Documents</Link>
                                </li>
                            </ul>
                        </aside>
                    </div>
                </div>
            )}
        </Drawer>
    );
}

export default App;
