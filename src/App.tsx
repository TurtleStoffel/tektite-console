import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Drawer from "./Drawer";
import CommandPanel from "./CommandPanel";
import MainContent from "./MainContent";
import NodeEditor from "./NodeEditor";
import ProjectDetails from "./ProjectDetails";
import "./index.css";
import { subscribeSelectedRepo } from "./events";

export function App() {
    const [commandInput, setCommandInput] = useState("");
    const [executionMessage, setExecutionMessage] = useState<string | null>(null);
    const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    type StreamMessage =
        | { type: "agent_message"; text?: string }
        | { type: "error"; error?: string }
        | { type: "done"; response?: string }
        | { type: "usage"; usage?: unknown }
        | { type: "thread"; threadId?: string | null }
        | { type: "item"; eventType: string; item: unknown };

    const handleExecute = async () => {
        const trimmedCommand = commandInput.trim();
        if (!trimmedCommand) {
            setExecutionMessage("Enter a command before executing.");
            return;
        }

        if (!selectedRepoUrl) {
            setExecutionMessage("Select a repository before executing.");
            return;
        }

        setIsExecuting(true);
        setExecutionMessage("Preparing workspace and starting Codex…");

        try {
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
                body: JSON.stringify({
                    prompt: trimmedCommand,
                    repository: { type: "git", url: selectedRepoUrl },
                }),
            });

            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({}));
                const message = errorBody?.error || `Execution failed with status ${res.status}`;
                throw new Error(message);
            }

            if (!res.body) {
                throw new Error("Server did not return a streaming response.");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let latestMessage = "";

            const processEvent = (rawEvent: string) => {
                const dataLines = rawEvent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith("data:"))
                    .map((line) => line.replace(/^data:\s?/, ""))
                    .filter(Boolean);

                if (!dataLines.length) return;

                const payload = JSON.parse(dataLines.join("\n")) as StreamMessage;

                if (payload.type === "error") {
                    throw new Error(payload.error || "Codex run failed.");
                }

                if (payload.type === "agent_message" && typeof payload.text === "string") {
                    latestMessage = payload.text;
                    setExecutionMessage(latestMessage);
                }

                if (payload.type === "done" && typeof payload.response === "string") {
                    latestMessage = payload.response;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let boundaryIndex = buffer.indexOf("\n\n");

                while (boundaryIndex !== -1) {
                    const rawEvent = buffer.slice(0, boundaryIndex);
                    buffer = buffer.slice(boundaryIndex + 2);
                    processEvent(rawEvent);
                    boundaryIndex = buffer.indexOf("\n\n");
                }
            }

            if (buffer.trim()) {
                processEvent(buffer.trim());
            }

            setExecutionMessage(latestMessage || "Codex run completed.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected error while executing.";
            setExecutionMessage(`Error: ${message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    useEffect(() => {
        return subscribeSelectedRepo(({ url }) => setSelectedRepoUrl(url));
    }, []);

    return (
        <Drawer
            side={
                <CommandPanel
                    commandInput={commandInput}
                    executionMessage={executionMessage}
                    isExecuting={isExecuting}
                    onChange={(value) => setCommandInput(value)}
                    onExecute={handleExecute}
                />
            }
        >
            {(drawerToggleId) => (
                <Routes>
                    <Route path="/" element={<MainContent drawerToggleId={drawerToggleId} />} />
                    <Route path="/editor" element={<NodeEditor drawerToggleId={drawerToggleId} />} />
                    <Route path="/projects/:id" element={<ProjectDetails drawerToggleId={drawerToggleId} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            )}
        </Drawer>
    );
}

export default App;
