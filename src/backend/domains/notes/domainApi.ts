import * as repository from "./repository";

export const notesService = {
    async listNotes() {
        const rows = await repository.listNotes();
        console.info("[notes] listed notes", { count: rows.length });
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            content: row.content,
            userId: row.user_id,
        }));
    },
};
