export type ProjectDetailsClonePrStatus = {
    state: "open" | "closed" | "merged" | "draft" | "none" | "unknown";
    number?: number;
    title?: string;
    url?: string;
} | null;

export type ProjectDetailsClone = {
    path: string;
    location: "clonesDir";
    promptSummary?: string | null;
    port?: number | null;
    commitHash?: string | null;
    commitDescription?: string | null;
    isWorktree?: boolean;
    inUse: boolean;
    hasChanges?: boolean;
    prStatus?: ProjectDetailsClonePrStatus;
    codexThreadId?: string | null;
    codexLastMessage?: string | null;
    codexLastEvent?: string | null;
};

export type ProjectDetailsPayload = {
    id: string;
    name: string;
    repositoryId: string | null;
    url: string | null;
    clones?: ProjectDetailsClone[];
};

export type PreviewTarget = {
    key: string;
    label: string;
    port: number;
};
