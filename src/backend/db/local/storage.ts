import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

type LocalStorage = {
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

        CREATE TABLE IF NOT EXISTS task_history (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            prompt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_done INTEGER NOT NULL DEFAULT 0,
            done_at TEXT
        );

        CREATE TABLE IF NOT EXISTS worktree_prompt_summaries (
            worktree_path TEXT PRIMARY KEY NOT NULL,
            prompt_summary TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS feature_flags (
            key TEXT PRIMARY KEY NOT NULL,
            description TEXT NOT NULL,
            is_enabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    `);

    const tasksColumns = sqlite.query("PRAGMA table_info(task_history)").all() as Array<{
        name: string;
    }>;
    const tasksColumnNames = new Set(tasksColumns.map((column) => column.name));
    if (!tasksColumnNames.has("is_done")) {
        sqlite.exec("ALTER TABLE task_history ADD COLUMN is_done INTEGER NOT NULL DEFAULT 0");
    }
    if (!tasksColumnNames.has("done_at")) {
        sqlite.exec("ALTER TABLE task_history ADD COLUMN done_at TEXT");
    }

    console.info("[storage:local] initialized sqlite database", { databasePath });
    return { db: drizzle(sqlite, { schema }) };
}
