import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

type LocalStorage = {
    db: BunSQLiteDatabase<typeof schema>;
};

export async function initLocalStorage(databasePath: string): Promise<LocalStorage> {
    const sqlite = new Database(databasePath);
    sqlite.exec("PRAGMA foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));
    migrate(db, { migrationsFolder });
    console.info("[storage:local] initialized sqlite database and applied migrations", {
        databasePath,
        migrationsFolder,
    });
    return { db };
}
