import { mkdir } from "fs/promises";
import { Database } from "bun:sqlite";

export type Storage = {
    db: Database;
};

export async function initStorage(dataDir: string): Promise<Storage> {
    await mkdir(dataDir, { recursive: true });

    const db = new Database(`${dataDir}/tektite-console.sqlite`, { create: true });
    db.run("PRAGMA foreign_keys = ON");

    const desiredSchemaVersion = 3;
    const currentSchemaVersionRow = db.query("PRAGMA user_version").get() as { user_version: number } | null;
    const currentSchemaVersion = currentSchemaVersionRow?.user_version ?? 0;
    if (currentSchemaVersion !== desiredSchemaVersion) {
        db.run("DROP TABLE IF EXISTS flow_edges");
        db.run("DROP TABLE IF EXISTS flow_nodes");
        db.run("DROP TABLE IF EXISTS projects");
        db.run("DROP TABLE IF EXISTS ideas");
        db.run("DROP TABLE IF EXISTS owners");
        db.run("DROP TABLE IF EXISTS flows");
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS flows (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL UNIQUE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS owners (
            id TEXT PRIMARY KEY,
            owner_type TEXT NOT NULL CHECK (owner_type IN ('project', 'idea'))
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            FOREIGN KEY (id) REFERENCES owners(id) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS ideas (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            FOREIGN KEY (id) REFERENCES owners(id) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS flow_nodes (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            key TEXT NOT NULL,
            owner_id TEXT REFERENCES owners(id) ON DELETE SET NULL,
            node_json TEXT NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_nodes_unique_key ON flow_nodes(flow_id, key)
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS flow_edges (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            key TEXT NOT NULL,
            source_node_id TEXT NOT NULL,
            target_node_id TEXT NOT NULL,
            source_handle TEXT,
            target_handle TEXT,
            edge_type TEXT,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
            FOREIGN KEY (source_node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE,
            FOREIGN KEY (target_node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_edges_unique_key ON flow_edges(flow_id, key)
    `);

    if (currentSchemaVersion !== desiredSchemaVersion) {
        db.run(`PRAGMA user_version = ${desiredSchemaVersion}`);
    }

    return { db };
}
