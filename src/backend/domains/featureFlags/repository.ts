import { asc, eq } from "drizzle-orm";
import { featureFlags } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export function listFeatureFlags() {
    const db = getDb();
    return db
        .select({
            key: featureFlags.key,
            description: featureFlags.description,
            isEnabled: featureFlags.isEnabled,
            createdAt: featureFlags.createdAt,
            updatedAt: featureFlags.updatedAt,
        })
        .from(featureFlags)
        .orderBy(asc(featureFlags.key))
        .execute();
}

export async function findFeatureFlagByKey(key: string) {
    const db = getDb();
    const rows = await db
        .select({
            key: featureFlags.key,
            description: featureFlags.description,
            isEnabled: featureFlags.isEnabled,
            createdAt: featureFlags.createdAt,
            updatedAt: featureFlags.updatedAt,
        })
        .from(featureFlags)
        .where(eq(featureFlags.key, key))
        .execute();
    return rows[0] ?? null;
}

export async function upsertFeatureFlag(input: {
    key: string;
    description: string;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}) {
    const db = getDb();
    await db
        .insert(featureFlags)
        .values(input)
        .onConflictDoUpdate({
            target: featureFlags.key,
            set: {
                description: input.description,
                isEnabled: input.isEnabled,
                updatedAt: input.updatedAt,
            },
        })
        .execute();
}
