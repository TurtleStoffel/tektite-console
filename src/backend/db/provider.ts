import type { SQL } from "bun";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

let currentDb: Db | null = null;
let currentSupabaseSql: SQL | null = null;

export function initDb(db: Db, supabaseSql: SQL) {
    currentDb = db;
    currentSupabaseSql = supabaseSql;
}

export function getDb(): Db {
    if (!currentDb) {
        throw new Error("Database not initialized.");
    }

    return currentDb;
}

export function getSupabaseSql(): SQL {
    if (!currentSupabaseSql) {
        throw new Error("Supabase SQL not initialized.");
    }

    return currentSupabaseSql;
}
