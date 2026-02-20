import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
});

export const projects = sqliteTable("projects", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    repositoryId: text("repository_id").references(() => repositories.id, {
        onDelete: "set null",
    }),
});

export const documents = sqliteTable("documents", {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, {
        onDelete: "set null",
    }),
    markdown: text("markdown").notNull(),
});

export const taskHistory = sqliteTable("task_history", {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, {
        onDelete: "set null",
    }),
    prompt: text("prompt").notNull(),
    createdAt: text("created_at").notNull(),
    isDone: integer("is_done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
});

export const worktreePromptSummaries = sqliteTable("worktree_prompt_summaries", {
    worktreePath: text("worktree_path").primaryKey(),
    promptSummary: text("prompt_summary").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});
