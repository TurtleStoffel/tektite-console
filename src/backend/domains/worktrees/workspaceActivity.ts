import fs from "node:fs";
import path from "node:path";
import { TEKTITE_PORT_FILE } from "../../../constants";

const codexWorkspaceActivity = new Map<string, boolean>();

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

export function markCodexWorkspaceActive(workspacePath: string) {
    setWorkspaceActivity(codexWorkspaceActivity, workspacePath, true);
}

export function markCodexWorkspaceInactive(workspacePath: string) {
    setWorkspaceActivity(codexWorkspaceActivity, workspacePath, false);
}

function hasActiveTektiteServer(workspacePath: string) {
    const tektitePortPath = path.join(workspacePath, TEKTITE_PORT_FILE);
    try {
        return fs.existsSync(tektitePortPath);
    } catch (error) {
        console.warn(`Failed checking ${TEKTITE_PORT_FILE} at ${tektitePortPath}`, error);
        return false;
    }
}

export function isWorkspaceActive(workspacePath: string) {
    if (!workspacePath) return false;
    return (
        hasActiveTektiteServer(workspacePath) || codexWorkspaceActivity.get(workspacePath) === true
    );
}
