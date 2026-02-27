type StreamMessage = { type?: string; error?: string };

type ExecuteTaskByIdInput = {
    taskId: string;
    signal: AbortSignal;
    onStarted?: () => void;
};

export async function executeTaskById({
    taskId,
    signal,
    onStarted,
}: ExecuteTaskByIdInput): Promise<{ completed: boolean }> {
    const res = await fetch("/api/execute", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
        },
        body: JSON.stringify({
            taskId,
        }),
        signal,
    });

    if (!res.ok) {
        const errorBody = await res.text();
        let message = `Execution failed with status ${res.status}`;
        if (errorBody.trim()) {
            try {
                const parsed = JSON.parse(errorBody) as unknown;
                if (
                    parsed &&
                    typeof parsed === "object" &&
                    "error" in parsed &&
                    typeof (parsed as { error?: unknown }).error === "string"
                ) {
                    message = (parsed as { error: string }).error;
                } else {
                    message = errorBody;
                }
            } catch {
                message = errorBody;
            }
        }
        throw new Error(message);
    }

    if (!res.body) {
        throw new Error("Server did not return a streaming response.");
    }

    onStarted?.();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawDone = false;

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

        if (payload.type === "done") {
            sawDone = true;
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

    buffer += decoder.decode();
    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        processEvent(rawEvent);
        boundaryIndex = buffer.indexOf("\n\n");
    }

    if (!signal.aborted && !sawDone && buffer.trim().length > 0) {
        return { completed: false };
    }

    return { completed: true };
}
