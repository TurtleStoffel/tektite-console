type TaskEditModalProps = {
    taskId: string | null;
    description: string;
    onDescriptionChange: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
    canSave: boolean;
    isSaving: boolean;
    errorMessage?: string | null;
};

export function TaskEditModal({
    taskId,
    description,
    onDescriptionChange,
    onClose,
    onSave,
    canSave,
    isSaving,
    errorMessage,
}: TaskEditModalProps) {
    if (!taskId) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h3 className="text-lg font-semibold">Edit task</h3>
                <p className="mt-1 text-sm text-base-content/70">
                    Task ID: <span className="font-mono">{taskId}</span>
                </p>
                {errorMessage && (
                    <div className="alert alert-error py-2 mt-4">
                        <span className="text-sm">{errorMessage}</span>
                    </div>
                )}
                <label className="form-control mt-4">
                    <span className="label-text text-sm font-medium">Description</span>
                    <textarea
                        className="textarea textarea-bordered min-h-36"
                        value={description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        disabled={isSaving}
                    />
                </label>
                <div className="modal-action">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canSave || isSaving}
                        onClick={onSave}
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
            <button
                type="button"
                className="modal-backdrop"
                onClick={() => {
                    if (isSaving) {
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
