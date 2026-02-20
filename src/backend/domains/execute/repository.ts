import { eq } from "drizzle-orm";
import { worktreePromptSummaries } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export async function upsertWorktreePromptSummary(input: {
    worktreePath: string;
    promptSummary: string;
}) {
    const db = getDb();
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
