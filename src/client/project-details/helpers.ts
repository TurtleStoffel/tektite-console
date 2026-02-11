import { normalizeRepoUrl } from "../../utils/normalizeRepoUrl";

import type {
    ParsedLogsPayload,
    PreviewTarget,
    ProjectDetailsClonePrStatus,
    ProjectDetailsPayload,
} from "./types";

export function parseLogsPayload(payload: unknown): ParsedLogsPayload {
    const maybePayload = payload as any;
    const lines = Array.isArray(maybePayload?.lines)
        ? (maybePayload.lines as unknown[]).filter((line) => typeof line === "string")
        : [];

    const partial = maybePayload?.partial;
    const partialLines: string[] = [];
    if (partial && typeof partial === "object") {
        const stdout = typeof partial.stdout === "string" ? partial.stdout : "";
        const stderr = typeof partial.stderr === "string" ? partial.stderr : "";
        if (stdout.trim()) partialLines.push(`[stdout] ${stdout.trimEnd()}`);
        if (stderr.trim()) partialLines.push(`[stderr] ${stderr.trimEnd()}`);
    }

    return {
        lines: [...lines, ...partialLines],
        meta: {
            path: typeof maybePayload?.path === "string" ? maybePayload.path : null,
            exists: Boolean(maybePayload?.exists),
            running: Boolean(maybePayload?.running),
            installing: Boolean(maybePayload?.installing),
        },
    };
}

export function shouldShowProductionClone(project: ProjectDetailsPayload | null): boolean {
    const projectRepo = normalizeRepoUrl(project?.url);
    const consoleRepo = normalizeRepoUrl(project?.consoleRepositoryUrl);
    if (projectRepo && consoleRepo && projectRepo === consoleRepo) return false;
    return true;
}

export function buildPreviewTargets(project: ProjectDetailsPayload | null, showProductionClone: boolean): PreviewTarget[] {
    const targets: PreviewTarget[] = [];

    for (const clone of project?.clones ?? []) {
        if (typeof clone.port !== "number" || !Number.isFinite(clone.port)) continue;
        targets.push({
            key: `clone:${clone.path}`,
            label: `clone · ${clone.port}`,
            port: clone.port,
        });
    }

    if (
        showProductionClone &&
        typeof project?.productionClone?.port === "number" &&
        Number.isFinite(project.productionClone.port)
    ) {
        targets.push({
            key: `production:${project.productionClone.path}`,
            label: `production · ${project.productionClone.port}`,
            port: project.productionClone.port,
        });
    }

    return targets;
}

type PullRequestState = NonNullable<ProjectDetailsClonePrStatus>["state"];

export function prBadgeClass(state: PullRequestState): string {
    switch (state) {
        case "open":
            return "badge-success";
        case "draft":
            return "badge-warning";
        case "merged":
            return "badge-secondary";
        case "closed":
            return "badge-error";
        case "none":
            return "badge-ghost";
        case "unknown":
        default:
            return "badge-outline";
    }
}

export function prBadgeLabel(prStatus: NonNullable<ProjectDetailsClonePrStatus>): string {
    switch (prStatus.state) {
        case "open":
            return "PR open";
        case "draft":
            return "PR draft";
        case "merged":
            return "PR merged";
        case "closed":
            return "PR closed";
        case "none":
            return "No PR";
        case "unknown":
        default:
            return "PR ?";
    }
}
