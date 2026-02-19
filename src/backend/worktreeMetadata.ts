import fs from "node:fs";
import path from "node:path";
import { TEKTITE_WORKTREE_METADATA_FILE } from "../constants";

type WorktreeMetadata = {
    promptSummary: string;
    createdAt: string;
};

export function writeWorktreeMetadata(options: { worktreePath: string; promptSummary: string }) {
    const metadataPath = path.join(options.worktreePath, TEKTITE_WORKTREE_METADATA_FILE);
    const payload: WorktreeMetadata = {
        promptSummary: options.promptSummary,
        createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2), "utf8");
    console.info("[worktree-metadata] wrote metadata file", {
        worktreePath: options.worktreePath,
        metadataPath,
    });
}

export function readWorktreePromptSummary(worktreePath: string): string | null {
    const metadataPath = path.join(worktreePath, TEKTITE_WORKTREE_METADATA_FILE);
    if (!fs.existsSync(metadataPath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(metadataPath, "utf8");
        const parsed = JSON.parse(raw) as Partial<WorktreeMetadata>;
        const summary = typeof parsed.promptSummary === "string" ? parsed.promptSummary.trim() : "";
        return summary.length > 0 ? summary : null;
    } catch (error) {
        console.warn("[worktree-metadata] failed to read metadata file", {
            metadataPath,
            error,
        });
        return null;
    }
}
