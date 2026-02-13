const terminalWorkspaceActivity = new Map<string, boolean>();
const codexWorkspaceActivity = new Map<string, boolean>();
const bunAppRunnerWorkspaceActivity = new Map<string, boolean>();

function setWorkspaceActivity(
    activityMap: Map<string, boolean>,
    workspacePath: string,
    isActive: boolean,
) {
    if (!workspacePath) return;
    if (isActive) {
        activityMap.set(workspacePath, true);
        return;
    }

    activityMap.delete(workspacePath);
}

export function markTerminalWorkspaceActive(workspacePath: string) {
    setWorkspaceActivity(terminalWorkspaceActivity, workspacePath, true);
}

export function markTerminalWorkspaceInactive(workspacePath: string) {
    setWorkspaceActivity(terminalWorkspaceActivity, workspacePath, false);
}

export function markCodexWorkspaceActive(workspacePath: string) {
    setWorkspaceActivity(codexWorkspaceActivity, workspacePath, true);
}

export function markCodexWorkspaceInactive(workspacePath: string) {
    setWorkspaceActivity(codexWorkspaceActivity, workspacePath, false);
}

export function markBunAppRunnerWorkspaceActive(workspacePath: string) {
    setWorkspaceActivity(bunAppRunnerWorkspaceActivity, workspacePath, true);
}

export function markBunAppRunnerWorkspaceInactive(workspacePath: string) {
    setWorkspaceActivity(bunAppRunnerWorkspaceActivity, workspacePath, false);
}

export function isWorkspaceActive(workspacePath: string) {
    if (!workspacePath) return false;
    return (
        terminalWorkspaceActivity.get(workspacePath) === true ||
        codexWorkspaceActivity.get(workspacePath) === true ||
        bunAppRunnerWorkspaceActivity.get(workspacePath) === true
    );
}
