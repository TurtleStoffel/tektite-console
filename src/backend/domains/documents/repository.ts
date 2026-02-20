import { asc, eq } from "drizzle-orm";
import { documents, projects } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export async function findProject(projectId: string) {
    const db = getDb();
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function listDocuments() {
    const db = getDb();
    return db
        .select({
            id: documents.id,
            projectId: documents.projectId,
            markdown: documents.markdown,
            projectName: projects.name,
        })
        .from(documents)
        .leftJoin(projects, eq(documents.projectId, projects.id))
        .orderBy(asc(projects.name), asc(documents.id))
        .execute();
}

export async function createDocument(values: {
    id: string;
    projectId: string | null;
    markdown: string;
}) {
    const db = getDb();
    await db.insert(documents).values(values).execute();
}

export function listProjectDocuments(projectId: string) {
    const db = getDb();
    return db
        .select({
            id: documents.id,
            projectId: documents.projectId,
            markdown: documents.markdown,
        })
        .from(documents)
        .where(eq(documents.projectId, projectId))
        .orderBy(asc(documents.id))
        .execute();
}

export async function findDocument(documentId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: documents.id,
            projectId: documents.projectId,
            markdown: documents.markdown,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .execute();
    return rows[0] ?? null;
}

export async function updateDocument(
    documentId: string,
    values: { projectId: string | null; markdown: string },
) {
    const db = getDb();
    await db
        .update(documents)
        .set({ markdown: values.markdown, projectId: values.projectId })
        .where(eq(documents.id, documentId))
        .execute();
}

export async function deleteDocument(documentId: string) {
    const db = getDb();
    await db.delete(documents).where(eq(documents.id, documentId)).execute();
}
