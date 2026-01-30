import { SQL } from "bun";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import * as schema from "./db/schema";

export type Storage = {
    db: BunSQLDatabase<typeof schema>;
};

export async function initStorage(databaseUrl: string): Promise<Storage> {
    const sql = new SQL(databaseUrl);
    const db = drizzle(sql, { schema });

    console.info("[storage] initialized postgres database");
    return { db };
}
