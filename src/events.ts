export const SELECTED_REPO_EVENT = "tektite:selected-repo" as const;

export type SelectedRepoEventDetail = {
    url: string | null;
    source: "grid" | "project-details";
};

export function emitSelectedRepo(detail: SelectedRepoEventDetail) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<SelectedRepoEventDetail>(SELECTED_REPO_EVENT, { detail }));
}

export function subscribeSelectedRepo(handler: (detail: SelectedRepoEventDetail) => void) {
    if (typeof window === "undefined") return () => {};

    const listener = (event: Event) => {
        const custom = event as CustomEvent<SelectedRepoEventDetail>;
        if (!custom.detail) return;
        handler(custom.detail);
    };

    window.addEventListener(SELECTED_REPO_EVENT, listener);
    return () => window.removeEventListener(SELECTED_REPO_EVENT, listener);
}

