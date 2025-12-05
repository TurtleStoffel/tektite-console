import { useState } from "react";
import Drawer from "./Drawer";
import CommandPanel from "./CommandPanel";
import MainContent from "./MainContent";
import "./index.css";

export function App() {
    const [commandInput, setCommandInput] = useState("");
    const [executionMessage, setExecutionMessage] = useState<string | null>(null);

    const handleExecute = () => {
        if (!commandInput.trim()) {
            setExecutionMessage("Enter a command before executing.");
            return;
        }
        setExecutionMessage(`Executed: ${commandInput.trim()}`);
    };

    const cells = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <Drawer
            side={
                <CommandPanel
                    commandInput={commandInput}
                    executionMessage={executionMessage}
                    onChange={(value) => setCommandInput(value)}
                    onExecute={handleExecute}
                />
            }
        >
            {(drawerToggleId) => <MainContent drawerToggleId={drawerToggleId} />}
        </Drawer>
    );
}

export default App;
