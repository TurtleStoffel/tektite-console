export function getErrorMessage(error: unknown, fallback: string | null = null): string | null {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string" && error.trim()) {
        return error;
    }
    if (error) {
        return String(error);
    }
    return fallback;
}
