import type { PreviewTarget, ProjectDetailsClonePrStatus, ProjectDetailsPayload } from "./types";

export function buildPreviewTargets(project: ProjectDetailsPayload | null): PreviewTarget[] {
    const targets: PreviewTarget[] = [];

    for (const clone of project?.clones ?? []) {
        if (typeof clone.port !== "number" || !Number.isFinite(clone.port)) continue;
        targets.push({
            key: `clone:${clone.path}`,
            label: `clone · ${clone.port}`,
            port: clone.port,
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
        default:
            return "PR ?";
    }
}
