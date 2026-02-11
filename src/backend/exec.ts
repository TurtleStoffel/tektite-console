import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

export const execAsync = promisify(exec);
export const execFileAsync = promisify(execFile);

export type ExecError = NodeJS.ErrnoException & {
    killed?: boolean;
    signal?: string | null;
    cmd?: string;
    stdout?: string;
    stderr?: string;
};

export function isExecTimeoutError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const maybe = error as Partial<ExecError>;
    return (
        maybe.code === "ETIMEDOUT" ||
        (maybe.killed === true && (maybe.signal === "SIGTERM" || maybe.signal === "SIGKILL"))
    );
}
