import { Navigate, Route, Routes } from "react-router-dom";
import Drawer from "./Drawer";
import CommandPanel from "./CommandPanel";
import MainContent from "./MainContent";
import NodeEditor from "./NodeEditor";
import ProjectDetails from "./ProjectDetails";
import EnvIndicator from "./EnvIndicator";
import "./index.css";

export function App() {
    return (
        <Drawer side={<CommandPanel />}>
            {(drawerToggleId) => (
                <>
                    <EnvIndicator />
                    <Routes>
                        <Route path="/" element={<MainContent drawerToggleId={drawerToggleId} />} />
                        <Route path="/editor" element={<NodeEditor drawerToggleId={drawerToggleId} />} />
                        <Route
                            path="/projects/:id"
                            element={<ProjectDetails drawerToggleId={drawerToggleId} />}
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </>
            )}
        </Drawer>
    );
}

export default App;
