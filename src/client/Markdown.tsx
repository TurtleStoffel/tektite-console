import { Fragment, type ReactNode, useMemo } from "react";

function safeHttpUrl(url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function renderStyledText(text: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const matcher = /(`[^`]+?`|\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
    let cursor = 0;

    for (const match of text.matchAll(matcher)) {
        const token = match[0];
        const at = match.index ?? 0;
        if (at > cursor) {
            nodes.push(
                <Fragment key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor, at)}</Fragment>,
            );
        }
        if (token.startsWith("`") && token.endsWith("`")) {
            nodes.push(<code key={`${keyPrefix}-code-${at}`}>{token.slice(1, -1)}</code>);
        } else if (token.startsWith("**") && token.endsWith("**")) {
            nodes.push(<strong key={`${keyPrefix}-strong-${at}`}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("*") && token.endsWith("*")) {
            nodes.push(<em key={`${keyPrefix}-em-${at}`}>{token.slice(1, -1)}</em>);
        } else {
            nodes.push(<Fragment key={`${keyPrefix}-raw-${at}`}>{token}</Fragment>);
        }
        cursor = at + token.length;
    }

    if (cursor < text.length) {
        nodes.push(<Fragment key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor)}</Fragment>);
    }

    return nodes;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const linkMatcher = /\[([^\]]+?)\]\(([^)]+?)\)/g;
    let cursor = 0;

    for (const match of text.matchAll(linkMatcher)) {
        const full = match[0];
        const label = match[1] ?? "";
        const href = match[2] ?? "";
        const at = match.index ?? 0;

        if (at > cursor) {
            nodes.push(...renderStyledText(text.slice(cursor, at), `${keyPrefix}-plain-${cursor}`));
        }

        const safeHref = safeHttpUrl(href.trim());
        if (safeHref) {
            nodes.push(
                <a
                    key={`${keyPrefix}-link-${at}`}
                    href={safeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="link link-hover"
                >
                    {renderStyledText(label, `${keyPrefix}-label-${at}`)}
                </a>,
            );
        } else {
            nodes.push(...renderStyledText(label, `${keyPrefix}-label-${at}`));
        }

        cursor = at + full.length;
    }

    if (cursor < text.length) {
        nodes.push(...renderStyledText(text.slice(cursor), `${keyPrefix}-plain-${cursor}`));
    }

    return nodes;
}

function markdownToElements(markdown: string) {
    const lines = markdown.replaceAll("\r\n", "\n").split("\n");
    const chunks: ReactNode[] = [];
    let index = 0;

    const flushParagraph = (paragraphLines: string[]) => {
        const text = paragraphLines
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ");
        if (!text) return;
        const key = `p-${index}-${paragraphLines.length}`;
        chunks.push(<p key={key}>{renderInline(text, key)}</p>);
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
            const key = `h-${index}`;
            if (level === 1) {
                chunks.push(
                    <h1 key={key} className="font-semibold text-sm mt-1">
                        {renderInline(text, key)}
                    </h1>,
                );
            } else if (level === 2) {
                chunks.push(
                    <h2 key={key} className="font-semibold text-sm mt-1">
                        {renderInline(text, key)}
                    </h2>,
                );
            } else {
                chunks.push(
                    <h3 key={key} className="font-semibold text-sm mt-1">
                        {renderInline(text, key)}
                    </h3>,
                );
            }
            index += 1;
            continue;
        }

        const listItems: string[] = [];
        const listStartIndex = index;
        while (index < lines.length) {
            const next = (lines[index] ?? "").trim();
            const listMatch = next.match(/^[-*]\s+(.*)$/);
            if (!listMatch) break;
            listItems.push(listMatch[1] ?? "");
            index += 1;
        }
        if (listItems.length > 0) {
            const key = `ul-${listStartIndex}`;
            const listNodes: ReactNode[] = [];
            let lineNumber = listStartIndex;
            for (const item of listItems) {
                const itemKey = `${key}-li-${lineNumber}`;
                listNodes.push(<li key={itemKey}>{renderInline(item, itemKey)}</li>);
                lineNumber += 1;
            }
            chunks.push(
                <ul key={key} className="list-disc pl-5 space-y-1">
                    {listNodes}
                </ul>,
            );
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

    return chunks;
}

export function Markdown({ markdown, className }: { markdown: string; className?: string }) {
    const content = useMemo(() => markdownToElements(markdown), [markdown]);
    return <div className={className}>{content}</div>;
}
