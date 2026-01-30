import { pgTable, text } from "drizzle-orm/pg-core";

export const repositories = pgTable("repositories", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
});

export const projects = pgTable("projects", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    repositoryId: text("repository_id").references(() => repositories.id, {
        onDelete: "set null",
    }),
});

export const documents = pgTable("documents", {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, {
        onDelete: "set null",
    }),
    markdown: text("markdown").notNull(),
});
