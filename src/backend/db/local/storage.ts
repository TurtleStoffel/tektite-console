import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

type LocalStorage = {
    db: BunSQLiteDatabase<typeof schema>;
};

const MAX_DATABASE_BACKUPS = 5;

function backupDatabaseBeforeMigration(databasePath: string): void {
    if (!existsSync(databasePath)) {
        console.info(
            "[storage:local] skipping database backup because sqlite file does not exist yet",
            {
                databasePath,
            },
        );
        return;
    }

    const databaseDirectory = path.dirname(databasePath);
    const backupsDirectory = path.join(databaseDirectory, "backups");
    mkdirSync(backupsDirectory, { recursive: true });

    const parsedPath = path.parse(databasePath);
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const backupFilename = `${parsedPath.name}-${timestamp}${parsedPath.ext || ".sqlite"}`;
    const backupPath = path.join(backupsDirectory, backupFilename);
    copyFileSync(databasePath, backupPath);
    console.info("[storage:local] created sqlite backup before migration", {
        databasePath,
        backupPath,
    });

    const backupFiles = readdirSync(backupsDirectory)
        .map((entry) => path.join(backupsDirectory, entry))
        .filter((entryPath) => statSync(entryPath).isFile())
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

    for (const staleBackupPath of backupFiles.slice(MAX_DATABASE_BACKUPS)) {
        unlinkSync(staleBackupPath);
        console.info("[storage:local] pruned old sqlite backup", { staleBackupPath });
    }
}

export async function initLocalStorage(databasePath: string): Promise<LocalStorage> {
    backupDatabaseBeforeMigration(databasePath);
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
