import path from "node:path";

export function isWithinRoot(candidate: string, root: string) {
    const resolvedCandidate = path.resolve(candidate);
    const resolvedRoot = path.resolve(root);
    return (
        resolvedCandidate === resolvedRoot ||
        resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
    );
}
