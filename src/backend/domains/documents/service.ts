import { randomUUID } from "node:crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

export function createDocumentsService(options: { db: Db }) {
    const { db } = options;

    return {
        async listDocuments() {
            const rows = await repository.listDocuments(db);
            return rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                projectName: row.projectName,
                markdown: row.markdown,
            }));
        },

        async createDocument(input: { markdown: string; projectId?: string | null }) {
            const projectId = normalizeProjectId(input.projectId);
            if (projectId) {
                const project = await repository.findProject(db, projectId);
                if (!project) return { error: "Project not found.", status: 404 as const };
            }

            const documentId = randomUUID();
            await repository.createDocument(db, {
                id: documentId,
                projectId,
                markdown: input.markdown,
            });
            console.info("[documents] created", { documentId, projectId });
            return { id: documentId, projectId, markdown: input.markdown };
        },

        async listProjectDocuments(projectId: string) {
            const project = await repository.findProject(db, projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
            const rows = await repository.listProjectDocuments(db, projectId);
            return rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                markdown: row.markdown,
            }));
        },

        async createProjectDocument(input: { projectId: string; markdown: string }) {
            const project = await repository.findProject(db, input.projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };

            const documentId = randomUUID();
            await repository.createDocument(db, {
                id: documentId,
                projectId: input.projectId,
                markdown: input.markdown,
            });
            console.info("[documents] created", { documentId, projectId: input.projectId });
            return { id: documentId, projectId: input.projectId, markdown: input.markdown };
        },

        async getDocument(documentId: string) {
            const document = await repository.findDocument(db, documentId);
            if (!document) return { error: "Document not found.", status: 404 as const };
            return document;
        },

        async updateDocument(input: {
            documentId: string;
            markdown: string;
            projectId?: string | null;
        }) {
            const projectId = normalizeProjectId(input.projectId);
            if (projectId) {
                const project = await repository.findProject(db, projectId);
                if (!project) return { error: "Project not found.", status: 404 as const };
            }

            await repository.updateDocument(db, input.documentId, {
                markdown: input.markdown,
                projectId,
            });
            const document = await repository.findDocument(db, input.documentId);
            console.info("[documents] updated", { documentId: input.documentId });
            return {
                id: document?.id ?? input.documentId,
                projectId: document?.projectId ?? projectId,
                markdown: document?.markdown ?? input.markdown,
            };
        },

        async deleteDocument(documentId: string) {
            await repository.deleteDocument(db, documentId);
            console.info("[documents] deleted", { documentId });
            return { id: documentId };
        },
    };
}
