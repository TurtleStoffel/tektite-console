import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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
