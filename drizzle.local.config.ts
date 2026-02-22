import { defineConfig } from "drizzle-kit";

const rawSqlitePath = process.env.SQLITE_PATH?.trim();
const rawDataDir = process.env.DATA_DIR?.trim();

const sqliteUrl = rawSqlitePath
    ? rawSqlitePath
    : rawDataDir
      ? `${rawDataDir}/tektite.sqlite`
      : "./.tektite.sqlite";

export default defineConfig({
    schema: "./src/backend/db/local/schema.ts",
    out: "./src/backend/db/local/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: sqliteUrl,
    },
    verbose: true,
    strict: true,
});
