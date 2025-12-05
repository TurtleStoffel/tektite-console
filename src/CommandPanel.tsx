type CommandPanelProps = {
    commandInput: string;
    executionMessage: string | null;
    onChange: (value: string) => void;
    onExecute: () => void;
};

export function CommandPanel({ commandInput, executionMessage, onChange, onExecute }: CommandPanelProps) {
    return (
        <>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Command drawer</h2>
                <p className="text-sm text-base-content/70">
                    Enter a command to execute or store alongside your selected repositories.
                </p>
            </div>
            <div className="form-control gap-2">
                <textarea
                    placeholder="Enter command"
                    className="textarea textarea-bordered w-full min-h-[120px]"
                    value={commandInput}
                    onChange={(event) => onChange(event.target.value)}
                />
                <button className="btn btn-primary mt-2" onClick={onExecute}>
                    Execute
                </button>
                {executionMessage && <p className="text-sm text-base-content/70">{executionMessage}</p>}
            </div>
        </>
    );
}

export default CommandPanel;
