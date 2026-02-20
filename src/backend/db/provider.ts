import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

let currentDb: Db | null = null;

export function initDb(db: Db) {
    currentDb = db;
}

export function getDb(): Db {
    if (!currentDb) {
        throw new Error("Database not initialized.");
    }

    return currentDb;
}
