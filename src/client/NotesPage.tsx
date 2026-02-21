import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage } from "./utils/errors";

type NotesPageProps = {
    drawerToggleId: string;
};

type Note = {
    id: string;
    title: string;
    createdAt: string;
    content: string | null;
    userId: string;
};

function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
}

function formatContent(content: string | null) {
    if (!content || !content.trim()) {
        return "-";
    }
    const normalized = content.replace(/\s+/g, " ").trim();
    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function NotesPage({ drawerToggleId }: NotesPageProps) {
    const fetchNotes = useCallback(async () => {
        const res = await fetch("/api/notes");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load notes.");
        }
        return Array.isArray(payload?.data) ? (payload.data as Note[]) : [];
    }, []);

    const {
        data: notes = [],
        isLoading,
        isFetching,
        error,
        refetch,
    } = useQuery<Note[]>({
        queryKey: ["notes"],
        queryFn: fetchNotes,
    });

    const loadError = getErrorMessage(error);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Notes</h1>
                    <p className="text-sm text-base-content/70">Supabase `public.notes` table.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void refetch()}
                        disabled={isLoading || isFetching}
                    >
                        {isLoading || isFetching ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {loadError && (
                <div className="alert alert-error text-sm">
                    <span>{loadError}</span>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            ) : notes.length === 0 ? (
                <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                    <div className="card-body">
                        <h2 className="card-title">No notes found</h2>
                        <p className="text-base-content/70">
                            No rows are currently available in Supabase `public.notes`.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Content</th>
                                <th>Created</th>
                                <th>User ID</th>
                                <th>ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notes.map((note) => (
                                <tr key={note.id}>
                                    <td className="font-medium">{note.title}</td>
                                    <td className="max-w-xl">{formatContent(note.content)}</td>
                                    <td className="whitespace-nowrap">
                                        {formatTimestamp(note.createdAt)}
                                    </td>
                                    <td className="font-mono text-xs">{note.userId}</td>
                                    <td className="font-mono text-xs">{note.id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
