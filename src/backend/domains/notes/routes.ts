import { notesService } from "./domainApi";

export function createNotesRoutes() {
    return {
        "/api/notes": {
            async GET() {
                const data = await notesService.listNotes();
                return Response.json({ data });
            },
        },
    } as const;
}
