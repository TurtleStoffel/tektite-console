const activeWorkspaces = new Set<string>();

export function markWorkspaceActive(workspacePath: string) {
    if (!workspacePath) return;
    activeWorkspaces.add(workspacePath);
}

export function markWorkspaceInactive(workspacePath: string) {
    if (!workspacePath) return;
    activeWorkspaces.delete(workspacePath);
}

export function isWorkspaceActive(workspacePath: string) {
    if (!workspacePath) return false;
    return activeWorkspaces.has(workspacePath);
}
