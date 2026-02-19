import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { worktreePromptSummaries } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export async function upsertWorktreePromptSummary(
    db: Db,
    input: { worktreePath: string; promptSummary: string },
) {
    const now = new Date().toISOString();
    const existing = await db
        .select({ worktreePath: worktreePromptSummaries.worktreePath })
        .from(worktreePromptSummaries)
        .where(eq(worktreePromptSummaries.worktreePath, input.worktreePath))
        .execute();

    if (existing.length > 0) {
        await db
            .update(worktreePromptSummaries)
            .set({
                promptSummary: input.promptSummary,
                updatedAt: now,
            })
            .where(eq(worktreePromptSummaries.worktreePath, input.worktreePath))
            .execute();
        return;
    }

    await db
        .insert(worktreePromptSummaries)
        .values({
            worktreePath: input.worktreePath,
            promptSummary: input.promptSummary,
            createdAt: now,
            updatedAt: now,
        })
        .execute();
}
