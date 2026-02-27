type TaskCreateAtPositionModalProps = {
    isOpen: boolean;
    description: string;
    isCreating: boolean;
    x: number | null;
    y: number | null;
    onDescriptionChange: (value: string) => void;
    onClose: () => void;
    onSubmit: () => void;
};

export function TaskCreateAtPositionModal({
    isOpen,
    description,
    isCreating,
    x,
    y,
    onDescriptionChange,
    onClose,
    onSubmit,
}: TaskCreateAtPositionModalProps) {
    if (!isOpen) {
        return null;
    }

    const canSubmit = description.trim().length > 0;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <h3 className="text-lg font-semibold">Create task</h3>
                <p className="mt-1 text-sm text-base-content/70">
                    Create a new task at canvas position{" "}
                    <span className="font-mono">
                        {x ?? "?"}, {y ?? "?"}
                    </span>
                    .
                </p>
                <label className="form-control mt-4">
                    <span className="label-text text-sm font-medium">Description</span>
                    <textarea
                        className="textarea textarea-bordered min-h-28"
                        value={description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        disabled={isCreating}
                    />
                </label>
                <div className="modal-action">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                        disabled={isCreating}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onSubmit}
                        disabled={!canSubmit || isCreating}
                    >
                        {isCreating ? "Creating..." : "Create task"}
                    </button>
                </div>
            </div>
            <button
                type="button"
                className="modal-backdrop"
                onClick={() => {
                    if (isCreating) {
                        return;
                    }
                    onClose();
                }}
            >
                Close
            </button>
        </div>
    );
}
