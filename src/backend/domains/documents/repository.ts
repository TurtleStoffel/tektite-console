import { asc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { documents, projects } from "../../db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

export async function findProject(db: Db, projectId: string) {
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function listDocuments(db: Db) {
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

export async function createDocument(
    db: Db,
    values: { id: string; projectId: string | null; markdown: string },
) {
    await db.insert(documents).values(values).execute();
}

export function listProjectDocuments(db: Db, projectId: string) {
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

export async function findDocument(db: Db, documentId: string) {
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
    db: Db,
    documentId: string,
    values: { projectId: string | null; markdown: string },
) {
    await db
        .update(documents)
        .set({ markdown: values.markdown, projectId: values.projectId })
        .where(eq(documents.id, documentId))
        .execute();
}

export async function deleteDocument(db: Db, documentId: string) {
    await db.delete(documents).where(eq(documents.id, documentId)).execute();
}
