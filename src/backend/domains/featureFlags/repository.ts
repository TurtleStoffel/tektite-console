import { asc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { featureFlags } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export function listFeatureFlags(db: Db) {
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

export async function findFeatureFlagByKey(db: Db, key: string) {
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

export async function upsertFeatureFlag(
    db: Db,
    input: {
        key: string;
        description: string;
        isEnabled: boolean;
        createdAt: string;
        updatedAt: string;
    },
) {
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
