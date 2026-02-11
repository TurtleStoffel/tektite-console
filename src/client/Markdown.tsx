import { useMemo } from "react";

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function safeHttpUrl(url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function renderInline(text: string) {
    let escaped = escapeHtml(text);

    escaped = escaped.replaceAll(/`([^`]+?)`/g, "<code>$1</code>");
    escaped = escaped.replaceAll(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replaceAll(/\*([^*]+?)\*/g, "<em>$1</em>");

    escaped = escaped.replaceAll(
        /\[([^\]]+?)\]\(([^)]+?)\)/g,
        (_match, label: string, url: string) => {
            const safe = safeHttpUrl(url.trim());
            if (!safe) return label;
            return `<a href="${escapeHtml(safe)}" target="_blank" rel="noreferrer" class="link link-hover">${escapeHtml(label)}</a>`;
        },
    );

    return escaped;
}

function markdownToHtml(markdown: string) {
    const lines = markdown.replaceAll("\r\n", "\n").split("\n");
    const chunks: string[] = [];
    let index = 0;

    const flushParagraph = (paragraphLines: string[]) => {
        const text = paragraphLines
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ");
        if (!text) return;
        chunks.push(`<p>${renderInline(text)}</p>`);
    };

    while (index < lines.length) {
        const line = lines[index] ?? "";
        const trimmed = line.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1]?.length ?? 1;
            const text = headingMatch[2] ?? "";
            chunks.push(
                `<h${level} class="font-semibold text-sm mt-1">${renderInline(text)}</h${level}>`,
            );
            index += 1;
            continue;
        }

        const listItems: string[] = [];
        while (index < lines.length) {
            const next = (lines[index] ?? "").trim();
            const listMatch = next.match(/^[-*]\s+(.*)$/);
            if (!listMatch) break;
            listItems.push(`<li>${renderInline(listMatch[1] ?? "")}</li>`);
            index += 1;
        }
        if (listItems.length > 0) {
            chunks.push(`<ul class="list-disc pl-5 space-y-1">${listItems.join("")}</ul>`);
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
            const next = lines[index] ?? "";
            const nextTrimmed = next.trim();
            if (!nextTrimmed) break;
            if (/^(#{1,3})\s+/.test(nextTrimmed)) break;
            if (/^[-*]\s+/.test(nextTrimmed)) break;
            paragraphLines.push(next);
            index += 1;
        }
        flushParagraph(paragraphLines);
    }

    return chunks.join("");
}

export function Markdown({ markdown, className }: { markdown: string; className?: string }) {
    const html = useMemo(() => markdownToHtml(markdown), [markdown]);
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
