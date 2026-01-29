import { Database } from "bun:sqlite";
import { mkdir } from "fs/promises";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./db/schema";

export type Storage = {
    db: BunSQLiteDatabase<typeof schema>;
};

export async function initStorage(dataDir: string): Promise<Storage> {
    await mkdir(dataDir, { recursive: true });

    const sqlite = new Database(`${dataDir}/tektite-console.sqlite`, { create: true });
    sqlite.run("PRAGMA foreign_keys = ON");

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL
        )
    `);
    sqlite.run(`
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        )
    `);
    sqlite.run(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            markdown TEXT NOT NULL
        )
    `);

    const db = drizzle(sqlite, { schema });
    console.info("[storage] initialized sqlite database", { dataDir });
    return { db };
}
