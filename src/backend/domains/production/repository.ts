import fs from "node:fs";
import { isWithinRoot } from "../../http/pathUtils";
import { isWorkspaceActive } from "../../workspaceActivity";
import {
    ensureProductionClone,
    getProductionCloneInfo,
    getProductionClonePath,
    updateProductionCloneMain,
} from "./productionClone";
import {
    getProductionServerLogs,
    isProductionInstallRunning,
    isProductionServerRunning,
    startProductionServer,
} from "./productionServer";

export function getClonePath(productionDir: string, repositoryUrl: string) {
    return getProductionClonePath(repositoryUrl, productionDir);
}

export function isWithinProductionDir(productionDir: string, clonePath: string) {
    return isWithinRoot(clonePath, productionDir);
}

export function cloneExists(clonePath: string) {
    return fs.existsSync(clonePath);
}

export function getLogs(clonePath: string) {
    return getProductionServerLogs(clonePath);
}

export function ensureClone(productionDir: string, repositoryUrl: string) {
    return ensureProductionClone({ repositoryUrl, productionDir });
}

export function isServerRunning(clonePath: string) {
    return isProductionServerRunning(clonePath);
}

export function isInstallRunning(clonePath: string) {
    return isProductionInstallRunning(clonePath);
}

export function isCloneWorkspaceActive(clonePath: string) {
    return isWorkspaceActive(clonePath);
}

export function startServer(clonePath: string) {
    return startProductionServer(clonePath);
}

export function readProductionCloneInfo(productionDir: string, repositoryUrl: string) {
    return getProductionCloneInfo({ repositoryUrl, productionDir });
}

export function updateCloneMain(productionDir: string, repositoryUrl: string) {
    return updateProductionCloneMain({ repositoryUrl, productionDir });
}
