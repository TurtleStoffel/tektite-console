import { mkdir } from "fs/promises";
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

export type Storage = {
    db: Database;
    defaultOwnerId: string;
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
        CREATE TABLE IF NOT EXISTS owners (
            id TEXT PRIMARY KEY,
            owner_type TEXT NOT NULL CHECK (owner_type IN ('project', 'idea'))
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
            name TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS ideas (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
            description TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS flow_nodes (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            key TEXT NOT NULL,
            owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
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

    const existingOwner = db.query("SELECT id FROM owners LIMIT 1").get() as { id: string } | null;
    if (existingOwner?.id) {
        return { db, defaultOwnerId: existingOwner.id };
    }

    const ownerId = randomUUID();
    const ideaId = randomUUID();
    db.query("INSERT INTO owners (id, owner_type) VALUES (?, 'idea')").run(ownerId);
    db.query("INSERT INTO ideas (id, owner_id, description) VALUES (?, ?, ?)").run(
        ideaId,
        ownerId,
        "Unassigned",
    );

    return { db, defaultOwnerId: ownerId };
}

