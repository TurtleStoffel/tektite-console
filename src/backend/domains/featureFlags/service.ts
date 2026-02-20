import type { FeatureFlag } from "@/shared/featureFlags";
import * as repository from "./repository";

export const featureFlagsService = {
    async listFeatureFlags(): Promise<FeatureFlag[]> {
        const rows = await repository.listFeatureFlags();
        return rows.map((row) => ({
            key: row.key,
            description: row.description,
            isEnabled: row.isEnabled,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
    },

    async upsertFeatureFlag(input: { key: string; description: string; isEnabled: boolean }) {
        const now = new Date().toISOString();
        const existing = await repository.findFeatureFlagByKey(input.key);
        await repository.upsertFeatureFlag({
            key: input.key,
            description: input.description,
            isEnabled: input.isEnabled,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        });

        console.info("[feature-flags] upserted feature flag", {
            key: input.key,
            isEnabled: input.isEnabled,
        });

        return {
            key: input.key,
            description: input.description,
            isEnabled: input.isEnabled,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        } satisfies FeatureFlag;
    },
};
