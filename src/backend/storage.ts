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
        CREATE TABLE IF NOT EXISTS flows (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL UNIQUE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS flow_nodes (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            key TEXT NOT NULL,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
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

    return { db };
}
