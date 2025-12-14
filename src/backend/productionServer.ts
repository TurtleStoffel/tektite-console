import { createBunAppRunner } from "./bunAppRunner";

const runner = createBunAppRunner({
    label: "production server",
    nodeEnv: "production",
    startCommand: ["bun", "run", "start"],
});

export function isProductionServerRunning(clonePath: string) {
    return runner.isServerRunning(clonePath);
}

export function isProductionInstallRunning(clonePath: string) {
    return runner.isInstallRunning(clonePath);
}

export function getProductionServerLogs(clonePath: string) {
    return runner.getLogs(clonePath);
}

export function startProductionServer(clonePath: string) {
    return runner.start(clonePath);
}
