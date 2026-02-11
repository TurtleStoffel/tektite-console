import { pgSchema } from "drizzle-orm/pg-core";

// Add Supabase/Postgres tables under this schema module.
export const supabaseSchema = pgSchema("public");
