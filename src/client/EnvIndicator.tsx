import { useEffect, useMemo, useState } from "react";

type EnvResponse = {
    nodeEnv: string | null;
    isProduction: boolean;
};

function getBadgeClass(nodeEnv: string) {
    if (nodeEnv === "…" || nodeEnv === "unknown") {
        return "badge-neutral";
    }
    switch (nodeEnv) {
        case "production":
            return "badge-success";
        case "test":
            return "badge-info";
        default:
            return "badge-warning";
    }
}

export function EnvIndicator() {
    const [env, setEnv] = useState<EnvResponse | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch("/api/env", {
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) {
                    throw new Error(`Failed to load env: HTTP ${response.status}`);
                }
                const json = (await response.json()) as EnvResponse;
                if (!cancelled) setEnv(json);
            } catch (error) {
                if (!cancelled)
                    setLoadError(error instanceof Error ? error.message : String(error));
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const { nodeEnv, title } = useMemo(() => {
        if (env) {
            const effectiveEnv = env.nodeEnv ?? "development";
            return {
                nodeEnv: effectiveEnv,
                title: env.nodeEnv ? `NODE_ENV=${env.nodeEnv}` : "NODE_ENV is not set",
            };
        }

        if (loadError) {
            return {
                nodeEnv: "unknown",
                title: `Failed to read NODE_ENV (${loadError})`,
            };
        }

        return {
            nodeEnv: "…",
            title: "Loading environment…",
        };
    }, [env, loadError]);

    return (
        <div className="fixed top-3 right-3 z-50">
            <span
                className={`badge badge-outline badge-sm ${getBadgeClass(nodeEnv)}`}
                title={title}
            >
                {nodeEnv}
            </span>
        </div>
    );
}

export default EnvIndicator;
