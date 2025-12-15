export function normalizeRepoUrl(raw: string | null | undefined): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const withoutGitPlus = trimmed.replace(/^git\\+/, "");

    let url: URL;
    try {
        url = new URL(withoutGitPlus);
    } catch {
        return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\.git$/, "").replace(/\/+$/, "");

    return `${url.protocol}//${url.host}${url.pathname}`;
}
