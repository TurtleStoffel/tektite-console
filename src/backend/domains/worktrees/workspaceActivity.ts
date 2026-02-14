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

export function isWorkspaceActive(workspacePath: string) {
    if (!workspacePath) return false;
    const tektitePortPath = path.join(workspacePath, TEKTITE_PORT_FILE);
    let hasActiveTektiteServer = false;
    try {
        if (fs.existsSync(tektitePortPath)) {
            const portText = fs.readFileSync(tektitePortPath, "utf8").trim();
            const port = Number.parseInt(portText, 10);
            hasActiveTektiteServer = Number.isInteger(port) && port > 0;
            if (!hasActiveTektiteServer) {
                console.warn(
                    `Invalid ${TEKTITE_PORT_FILE} contents at ${tektitePortPath}: ${portText}`,
                );
            }
        }
    } catch (error) {
        console.warn(`Failed reading ${TEKTITE_PORT_FILE} at ${tektitePortPath}`, error);
    }

    return hasActiveTektiteServer || codexWorkspaceActivity.get(workspacePath) === true;
}
