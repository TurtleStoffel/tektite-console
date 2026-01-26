import { Database } from "bun:sqlite";
import { mkdir } from "fs/promises";

export type Storage = {
    db: Database;
};

export async function initStorage(dataDir: string): Promise<Storage> {
    await mkdir(dataDir, { recursive: true });

    const db = new Database(`${dataDir}/tektite-console.sqlite`, { create: true });
    db.run("PRAGMA foreign_keys = ON");

    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            markdown TEXT NOT NULL
        )
    `);

    return { db };
}
