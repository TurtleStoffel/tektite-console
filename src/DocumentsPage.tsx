import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "./Markdown";

type DocumentsPageProps = {
    drawerToggleId: string;
};

type DocumentSummary = {
    id: string;
    projectId: string | null;
    projectName: string | null;
    markdown: string;
};

type DocumentEditorState = {
    id: string;
    projectId: string | null;
    projectName: string | null;
    markdown: string;
};

export function DocumentsPage({ drawerToggleId }: DocumentsPageProps) {
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [editor, setEditor] = useState<DocumentEditorState | null>(null);
    const [editorMarkdown, setEditorMarkdown] = useState("");
    const [editorLoading, setEditorLoading] = useState(false);
    const [editorSaving, setEditorSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);

    const loadDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/documents");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load documents.");
            }
            const list = Array.isArray(payload?.documents)
                ? (payload.documents as DocumentSummary[])
                : [];
            setDocuments(list);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load documents.";
            setError(message);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDocuments();
    }, []);

    const createDocument = async () => {
        setCreating(true);
        setError(null);
        try {
            const res = await fetch("/api/documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markdown: "# New document\n" }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create document.");
            }
            const created = {
                id: payload.id as string,
                projectId: (payload.projectId as string | null) ?? null,
                projectName: null,
                markdown: (payload.markdown as string) ?? "",
            };
            setEditor(created);
            setEditorMarkdown(created.markdown);
            await loadDocuments();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create document.";
            setError(message);
        } finally {
            setCreating(false);
        }
    };

    const openEditor = async (documentId: string) => {
        setEditorLoading(true);
        setEditorError(null);
        try {
            const res = await fetch(`/api/documents/${documentId}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load document.");
            }
            const projectName = documents.find((doc) => doc.id === documentId)?.projectName ?? null;
            const nextEditor = {
                id: payload.id as string,
                projectId: (payload.projectId as string | null) ?? null,
                projectName,
                markdown: (payload.markdown as string) ?? "",
            };
            setEditor(nextEditor);
            setEditorMarkdown(nextEditor.markdown);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load document.";
            setEditorError(message);
        } finally {
            setEditorLoading(false);
        }
    };

    const closeEditor = () => {
        if (editorSaving) return;
        setEditor(null);
        setEditorMarkdown("");
        setEditorError(null);
        setEditorLoading(false);
    };

    const saveEditor = async () => {
        if (!editor) return;
        setEditorSaving(true);
        setEditorError(null);
        try {
            const res = await fetch(`/api/documents/${editor.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    markdown: editorMarkdown,
                    projectId: editor.projectId,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to save document.");
            }
            const nextEditor = {
                ...editor,
                markdown: (payload.markdown as string) ?? editorMarkdown,
            };
            setEditor(nextEditor);
            await loadDocuments();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save document.";
            setEditorError(message);
        } finally {
            setEditorSaving(false);
        }
    };

    return (
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Documents</h1>
                    <p className="text-sm text-base-content/70">
                        Markdown notes connected to projects or standalone.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={createDocument}
                        disabled={creating}
                    >
                        {creating ? "Creating..." : "New document"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={loadDocuments}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {error && (
                <div className="alert alert-error text-sm">
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            ) : documents.length === 0 ? (
                <div className="card bg-base-200 border border-base-300 shadow-md text-left">
                    <div className="card-body">
                        <h2 className="card-title">No documents yet</h2>
                        <p className="text-base-content/70">
                            Create documents to capture Markdown notes for your projects.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {documents.map((document) => {
                        const projectName = document.projectName?.trim() || "Unassigned";
                        return (
                            <div
                                key={document.id}
                                className="card bg-base-200 border border-base-300 shadow-md"
                            >
                                <div className="card-body space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="text-sm text-base-content/60">
                                                Project
                                            </div>
                                            {document.projectId ? (
                                                <Link
                                                    to={`/projects/${document.projectId}`}
                                                    className="link link-hover"
                                                >
                                                    {projectName}
                                                </Link>
                                            ) : (
                                                <div className="text-sm text-base-content/70">
                                                    {projectName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-base-content/50 font-mono">
                                            {document.id}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-xs"
                                            onClick={() => void openEditor(document.id)}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                    <div className="bg-base-100/70 border border-base-300 rounded-xl p-4 max-h-48 overflow-auto">
                                        <Markdown
                                            markdown={document.markdown}
                                            className="text-sm text-base-content/80 space-y-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <dialog
                className={`modal ${editor || editorLoading ? "modal-open" : ""}`}
                aria-labelledby="document-editor-title"
            >
                <div className="modal-box max-w-3xl">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h3 id="document-editor-title" className="text-lg font-semibold">
                                Document editor
                            </h3>
                            <p className="text-sm text-base-content/70">
                                {editor?.projectId
                                    ? `Linked to ${editor.projectName ?? "project"}`
                                    : "Not linked to a project"}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={closeEditor}
                            disabled={editorSaving}
                        >
                            Close
                        </button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {editorError && (
                            <div className="alert alert-error text-sm">
                                <span>{editorError}</span>
                            </div>
                        )}
                        {editorLoading ? (
                            <div className="flex items-center gap-2 text-sm text-base-content/70">
                                <span className="loading loading-spinner loading-sm" />
                                <span>Loading document...</span>
                            </div>
                        ) : (
                            <textarea
                                className="textarea textarea-bordered w-full min-h-[220px] font-mono text-sm"
                                value={editorMarkdown}
                                onChange={(event) => setEditorMarkdown(event.target.value)}
                            />
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={saveEditor}
                                disabled={editorSaving || editorLoading || !editor}
                            >
                                {editorSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop" onClick={closeEditor}>
                    <button type="button">close</button>
                </form>
            </dialog>
        </div>
    );
}

export default DocumentsPage;
