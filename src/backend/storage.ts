import type { SQL } from "bun";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as localSchema from "./db/local/schema";
import { initLocalStorage } from "./db/local/storage";
import { initSupabaseStorage } from "./db/supabase/storage";

type Storage = {
    localDb: BunSQLiteDatabase<typeof localSchema>;
    supabaseDb: BunSQLDatabase<Record<string, never>>;
    supabaseSql: SQL;
};

export async function initStorage(options: {
    localDatabasePath: string;
    supabaseDatabaseUrl: string;
}): Promise<Storage> {
    const { localDatabasePath, supabaseDatabaseUrl } = options;
    const [{ db: localDb }, { db: supabaseDb, sql: supabaseSql }] = await Promise.all([
        initLocalStorage(localDatabasePath),
        initSupabaseStorage(supabaseDatabaseUrl),
    ]);

    console.info("[storage] initialized split database storage", {
        local: "sqlite",
        remote: "supabase",
    });
    return { localDb, supabaseDb, supabaseSql };
}
