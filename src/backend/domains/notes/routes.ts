import { notesService } from "./service";

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
