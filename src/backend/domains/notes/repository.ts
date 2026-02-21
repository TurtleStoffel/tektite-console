import { getSupabaseSql } from "../../db/provider";

type NoteRow = {
    id: string;
    title: string;
    created_at: string;
    content: string | null;
    user_id: string;
};

export async function listNotes() {
    const sql = getSupabaseSql();
    const rows = await sql<NoteRow[]>`
        select id, title, created_at, content, user_id
        from public.notes
        order by created_at desc, id desc
    `;
    return rows;
}
