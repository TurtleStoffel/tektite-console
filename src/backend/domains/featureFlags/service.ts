import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { FeatureFlag } from "@/shared/featureFlags";
import type * as schema from "../../db/local/schema";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

export function createFeatureFlagsService(options: { db: Db }) {
    const { db } = options;

    return {
        async listFeatureFlags(): Promise<FeatureFlag[]> {
            const rows = await repository.listFeatureFlags(db);
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
            const existing = await repository.findFeatureFlagByKey(db, input.key);
            await repository.upsertFeatureFlag(db, {
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
}
