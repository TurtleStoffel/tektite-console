type ExecuteTaskByIdInput = {
    taskId: string;
    onQueued?: (runId: string) => void;
};

export async function executeTaskById({
    taskId,
    onQueued,
}: ExecuteTaskByIdInput): Promise<{ runId: string }> {
    const res = await fetch("/api/execute", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            taskId,
        }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            typeof payload?.error === "string"
                ? payload.error
                : `Execution failed with status ${res.status}`,
        );
    }

    const runId = typeof payload?.data?.runId === "string" ? payload.data.runId : "";
    if (!runId) {
        throw new Error("Execution queue response did not include a run id.");
    }

    onQueued?.(runId);
    return { runId };
}
