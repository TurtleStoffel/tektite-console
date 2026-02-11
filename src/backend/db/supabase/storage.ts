import { SQL } from "bun";
import { type BunSQLDatabase, drizzle } from "drizzle-orm/bun-sql";

export type SupabaseStorage = {
    db: BunSQLDatabase<Record<string, never>>;
    sql: SQL;
};

export async function initSupabaseStorage(databaseUrl: string): Promise<SupabaseStorage> {
    const sql = new SQL(databaseUrl);
    await sql`select 1 as ok`;

    console.info("[storage:supabase] initialized supabase database connection", {
        healthcheck: "ok",
    });

    return {
        db: drizzle(sql),
        sql,
    };
}
