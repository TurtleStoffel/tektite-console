import { readNodeEnv } from "./repository";

export function createEnvService() {
    return {
        getEnv() {
            const nodeEnv = readNodeEnv();
            return {
                nodeEnv: nodeEnv ?? null,
                isProduction: nodeEnv === "production",
            };
        },
    };
}
