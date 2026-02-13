export type ProjectDetailsRemoteBranch = {
    status: "upToDate" | "behind" | "ahead" | "diverged" | "noUpstream" | "notGit" | "unknown";
    branch?: string;
    upstream?: string | null;
    aheadCount?: number;
    behindCount?: number;
    fetched?: boolean;
    error?: string;
    checkedAt: string;
} | null;

export type ProjectDetailsClonePrStatus = {
    state: "open" | "closed" | "merged" | "draft" | "none" | "unknown";
    number?: number;
    title?: string;
    url?: string;
} | null;

export type ProjectDetailsClone = {
    path: string;
    location: "clonesDir";
    port?: number | null;
    commitHash?: string | null;
    commitDescription?: string | null;
    isWorktree?: boolean;
    inUse: boolean;
    hasChanges?: boolean;
    prStatus?: ProjectDetailsClonePrStatus;
};

export type ProjectDetailsProductionClone = {
    path: string;
    exists: boolean;
    port: number | null;
    commitHash: string | null;
    commitDescription: string | null;
    hasChanges: boolean | null;
    inUse: boolean;
};

export type ProjectDetailsPayload = {
    id: string;
    name: string;
    repositoryId: string | null;
    url: string | null;
    consoleRepositoryUrl?: string | null;
    remoteBranch?: ProjectDetailsRemoteBranch;
    productionClone?: ProjectDetailsProductionClone | null;
    clones?: ProjectDetailsClone[];
};

export type PreviewTarget = {
    key: string;
    label: string;
    port: number;
};
