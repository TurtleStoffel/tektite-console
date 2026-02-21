import { randomUUID } from "node:crypto";
import * as repository from "./repository";

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

export const documentsService = {
    async listDocuments() {
        const rows = await repository.listDocuments();
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
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        const documentId = randomUUID();
        await repository.createDocument({
            id: documentId,
            projectId,
            markdown: input.markdown,
        });
        console.info("[documents] created", { documentId, projectId });
        return { id: documentId, projectId, markdown: input.markdown };
    },

    async listProjectDocuments(projectId: string) {
        const project = await repository.findProject(projectId);
        if (!project) return { error: "Project not found.", status: 404 as const };
        const rows = await repository.listProjectDocuments(projectId);
        return rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            markdown: row.markdown,
        }));
    },

    async createProjectDocument(input: { projectId: string; markdown: string }) {
        const project = await repository.findProject(input.projectId);
        if (!project) return { error: "Project not found.", status: 404 as const };

        const documentId = randomUUID();
        await repository.createDocument({
            id: documentId,
            projectId: input.projectId,
            markdown: input.markdown,
        });
        console.info("[documents] created", { documentId, projectId: input.projectId });
        return { id: documentId, projectId: input.projectId, markdown: input.markdown };
    },

    async getDocument(documentId: string) {
        const document = await repository.findDocument(documentId);
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
            const project = await repository.findProject(projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };
        }

        await repository.updateDocument(input.documentId, {
            markdown: input.markdown,
            projectId,
        });
        const document = await repository.findDocument(input.documentId);
        console.info("[documents] updated", { documentId: input.documentId });
        return {
            id: document?.id ?? input.documentId,
            projectId: document?.projectId ?? projectId,
            markdown: document?.markdown ?? input.markdown,
        };
    },

    async deleteDocument(documentId: string) {
        await repository.deleteDocument(documentId);
        console.info("[documents] deleted", { documentId });
        return { id: documentId };
    },
};
