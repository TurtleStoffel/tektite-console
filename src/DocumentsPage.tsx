import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "./Markdown";
import { getErrorMessage } from "./utils/errors";

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
    const [editor, setEditor] = useState<DocumentEditorState | null>(null);
    const [editorMarkdown, setEditorMarkdown] = useState("");
    const [editorError, setEditorError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const fetchDocuments = useCallback(async () => {
        const res = await fetch("/api/documents");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to load documents.");
        }
        return Array.isArray(payload?.documents) ? (payload.documents as DocumentSummary[]) : [];
    }, []);

    const {
        data: documents = [],
        isLoading: loading,
        isFetching: isRefreshing,
        error: documentsErrorRaw,
        refetch: refetchDocuments,
    } = useQuery<DocumentSummary[]>({
        queryKey: ["documents"],
        queryFn: fetchDocuments,
    });

    const createDocumentMutation = useMutation<DocumentSummary, Error, void>({
        mutationFn: async () => {
            const res = await fetch("/api/documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markdown: "# New document\n" }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to create document.");
            }
            return payload as DocumentSummary;
        },
        onSuccess: async (payload: DocumentSummary) => {
            const created = {
                id: payload.id as string,
                projectId: (payload.projectId as string | null) ?? null,
                projectName: payload.projectName ?? null,
                markdown: (payload.markdown as string) ?? "",
            };
            setEditor(created);
            setEditorMarkdown(created.markdown);
            await queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
    });

    const openEditorMutation = useMutation<DocumentSummary, Error, string>({
        mutationFn: async (documentId: string) => {
            const res = await fetch(`/api/documents/${documentId}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load document.");
            }
            return payload as DocumentSummary;
        },
        onSuccess: (payload: DocumentSummary) => {
            const projectName =
                documents.find((doc: DocumentSummary) => doc.id === payload.id)?.projectName ??
                null;
            const nextEditor = {
                id: payload.id as string,
                projectId: (payload.projectId as string | null) ?? null,
                projectName,
                markdown: (payload.markdown as string) ?? "",
            };
            setEditor(nextEditor);
            setEditorMarkdown(nextEditor.markdown);
        },
        onError: (err: Error) => {
            const message = err instanceof Error ? err.message : "Failed to load document.";
            setEditorError(message);
        },
    });

    const saveDocumentMutation = useMutation<
        DocumentSummary,
        Error,
        { id: string; markdown: string; projectId: string | null }
    >({
        mutationFn: async (payload: { id: string; markdown: string; projectId: string | null }) => {
            const res = await fetch(`/api/documents/${payload.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    markdown: payload.markdown,
                    projectId: payload.projectId,
                }),
            });
            const responsePayload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(responsePayload?.error || "Failed to save document.");
            }
            return responsePayload as DocumentSummary;
        },
        onSuccess: async (payload: DocumentSummary) => {
            if (!editor) return;
            const nextEditor = {
                ...editor,
                markdown: (payload.markdown as string) ?? editorMarkdown,
            };
            setEditor(nextEditor);
            await queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
        onError: (err: Error) => {
            const message = err instanceof Error ? err.message : "Failed to save document.";
            setEditorError(message);
        },
    });

    const createDocument = useCallback(() => {
        createDocumentMutation.mutate();
    }, [createDocumentMutation]);

    const openEditor = useCallback(
        (documentId: string) => {
            setEditorError(null);
            openEditorMutation.mutate(documentId);
        },
        [openEditorMutation],
    );

    const closeEditor = () => {
        if (saveDocumentMutation.isPending) return;
        setEditor(null);
        setEditorMarkdown("");
        setEditorError(null);
        openEditorMutation.reset();
        saveDocumentMutation.reset();
    };

    const saveEditor = async () => {
        if (!editor) return;
        setEditorError(null);
        saveDocumentMutation.mutate({
            id: editor.id,
            markdown: editorMarkdown,
            projectId: editor.projectId,
        });
    };

    const documentsError = getErrorMessage(documentsErrorRaw);
    const createError = getErrorMessage(createDocumentMutation.error);
    const pageError = createError ?? documentsError;
    const creating = createDocumentMutation.isPending;
    const editorLoading = openEditorMutation.isPending;
    const editorSaving = saveDocumentMutation.isPending;

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
                        onClick={() => void refetchDocuments()}
                        disabled={loading || isRefreshing}
                    >
                        {loading || isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {pageError && (
                <div className="alert alert-error text-sm">
                    <span>{pageError}</span>
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
                    {documents.map((document: DocumentSummary) => {
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
                <form
                    method="dialog"
                    className="modal-backdrop"
                    onClick={closeEditor}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            closeEditor();
                        }
                    }}
                >
                    <button type="button">close</button>
                </form>
            </dialog>
        </div>
    );
}

export default DocumentsPage;
