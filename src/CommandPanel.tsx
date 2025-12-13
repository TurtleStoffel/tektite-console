import { useEffect, useState } from "react";
import { subscribeSelectedRepo } from "./events";

type CommandPanelProps = {
    commandInput: string;
    executionMessage: string | null;
    isExecuting?: boolean;
    onChange: (value: string) => void;
    onExecute: () => void;
};

export function CommandPanel({
    commandInput,
    executionMessage,
    isExecuting = false,
    onChange,
    onExecute,
}: CommandPanelProps) {
    const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);

    useEffect(() => {
        return subscribeSelectedRepo(({ url }) => setSelectedRepoUrl(url));
    }, []);

    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Command drawer</h2>
                <p className="text-sm text-base-content/70">
                    Enter a command to execute or store alongside your selected repositories.
                </p>
                <div className="text-sm text-base-content/70">
                    <span className="font-semibold">Active repository:</span>{" "}
                    {selectedRepoUrl ? (
                        <a href={selectedRepoUrl} className="link link-hover break-all" target="_blank" rel="noreferrer">
                            {selectedRepoUrl}
                        </a>
                    ) : (
                        <span className="text-base-content/60">Pick a repository from the grid to run Codex.</span>
                    )}
                </div>
            </div>
            <div className="form-control gap-2">
                <textarea
                    placeholder="Enter command"
                    className="textarea textarea-bordered w-full min-h-[120px]"
                    value={commandInput}
                    onChange={(event) => onChange(event.target.value)}
                />
                <button className="btn btn-primary mt-2" onClick={onExecute} disabled={isExecuting}>
                    {isExecuting ? "Executing…" : "Execute"}
                </button>
                {executionMessage && <p className="text-sm text-base-content/70">{executionMessage}</p>}
            </div>
        </>
    );
}

export default CommandPanel;
