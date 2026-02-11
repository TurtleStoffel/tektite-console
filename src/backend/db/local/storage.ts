import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export type LocalStorage = {
    db: BunSQLiteDatabase<typeof schema>;
};

export async function initLocalStorage(databasePath: string): Promise<LocalStorage> {
    const sqlite = new Database(databasePath);
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            markdown TEXT NOT NULL
        );
    `);

    console.info("[storage:local] initialized sqlite database", { databasePath });
    return { db: drizzle(sqlite, { schema }) };
}
