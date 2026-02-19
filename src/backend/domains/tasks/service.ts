import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/local/schema";
import { execAsync } from "../../exec";
import { cleanRepositoryUrl } from "../../git";
import * as repository from "./repository";

type Db = BunSQLiteDatabase<typeof schema>;

function normalizeProjectId(projectId: string | null | undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    return raw.length > 0 ? raw : null;
}

function canonicalRepoId(repoUrl: string): string | null {
    const clean = cleanRepositoryUrl(repoUrl).trim();
    if (!clean) return null;

    const normalizePath = (rawPath: string) => {
        const trimmed = rawPath.replace(/^\/+/, "").replace(/\.git$/i, "");
        if (!trimmed) return null;
        return trimmed;
    };

    if (/^[a-zA-Z0-9._-]+@[^:]+:.+/.test(clean)) {
        const match = clean.match(/^([^@]+)@([^:]+):(.+)$/);
        if (!match) return null;
        const host = match[2]?.toLowerCase();
        const repoPath = normalizePath(match[3] ?? "");
        if (!host || !repoPath) return null;
        return `${host}/${repoPath}`.toLowerCase();
    }

    try {
        const parsed = new URL(clean);
        const host = parsed.host.toLowerCase();
        const repoPath = normalizePath(parsed.pathname);
        if (!host || !repoPath) return null;
        return `${host}/${repoPath}`.toLowerCase();
    } catch {
        return null;
    }
}

async function readOriginUrl(dir: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync("git config --get remote.origin.url", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const value = stdout.trim();
        return value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function parseTaskCreatedAtMs(createdAt: string) {
    const value = Date.parse(createdAt);
    return Number.isFinite(value) ? value : Number.NaN;
}

export function createTasksService(options: { db: Db }) {
    const { db } = options;

    return {
        async listTaskHistory() {
            const rows = await repository.listTaskHistory(db);
            return rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                prompt: row.prompt,
                createdAt: row.createdAt,
                isDone: row.isDone,
                doneAt: row.doneAt,
            }));
        },

        async listProjectTaskHistory(projectId: string, filter?: { isDone?: boolean }) {
            const project = await repository.findProject(db, projectId);
            if (!project) return { error: "Project not found.", status: 404 as const };

            const rows = await repository.listProjectTaskHistory(db, projectId, filter);
            return rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                prompt: row.prompt,
                createdAt: row.createdAt,
                isDone: row.isDone,
                doneAt: row.doneAt,
            }));
        },

        async createTaskHistory(input: { projectId?: string | null; prompt: string }) {
            const projectId = normalizeProjectId(input.projectId);
            if (projectId) {
                const project = await repository.findProject(db, projectId);
                if (!project) return { error: "Project not found.", status: 404 as const };
            }

            const id = randomUUID();
            const createdAt = new Date().toISOString();
            await repository.createTaskHistory(db, {
                id,
                projectId,
                prompt: input.prompt,
                createdAt,
                isDone: false,
                doneAt: null,
            });
            console.info("[tasks] created task history", { id, projectId });
            return {
                id,
                projectId,
                prompt: input.prompt,
                createdAt,
                isDone: false,
                doneAt: null,
            };
        },

        async markTaskHistoryDone(taskId: string) {
            const task = await repository.findTaskHistoryById(db, taskId);
            if (!task) return { error: "Task not found.", status: 404 as const };
            if (task.isDone) return task;

            const doneAt = new Date().toISOString();
            await repository.markTaskHistoryDone(db, taskId, doneAt);
            console.info("[tasks] marked task done", { taskId, doneAt });
            return { ...task, isDone: true, doneAt };
        },

        async autoMarkTaskDoneForRemovableWorktree(worktreePath: string) {
            if (!worktreePath || !fs.existsSync(worktreePath)) {
                return null;
            }

            const originUrl = await readOriginUrl(worktreePath);
            if (!originUrl) {
                return null;
            }

            const originRepoId = canonicalRepoId(originUrl);
            if (!originRepoId) {
                return null;
            }

            const projects = await repository.listProjectsWithRepositoryUrls(db);
            const matchingProject = projects.find((candidate) => {
                if (!candidate.repositoryUrl) return false;
                return canonicalRepoId(candidate.repositoryUrl) === originRepoId;
            });
            if (!matchingProject) {
                return null;
            }

            const pendingTasks = await repository.listPendingProjectTasks(
                db,
                matchingProject.projectId,
            );
            if (pendingTasks.length === 0) {
                return null;
            }

            const worktreeStats = fs.statSync(worktreePath);
            const worktreeTimeMs =
                typeof worktreeStats.birthtimeMs === "number" &&
                Number.isFinite(worktreeStats.birthtimeMs)
                    ? worktreeStats.birthtimeMs
                    : worktreeStats.ctimeMs;

            const selectedTask = pendingTasks.reduce<
                (typeof pendingTasks)[number] | undefined
            >((closest, task) => {
                const taskCreatedAtMs = parseTaskCreatedAtMs(task.createdAt);
                if (!Number.isFinite(taskCreatedAtMs)) {
                    return closest;
                }

                if (!closest) {
                    return task;
                }

                const closestCreatedAtMs = parseTaskCreatedAtMs(closest.createdAt);
                if (!Number.isFinite(closestCreatedAtMs)) {
                    return task;
                }

                const currentDistance = Math.abs(worktreeTimeMs - taskCreatedAtMs);
                const closestDistance = Math.abs(worktreeTimeMs - closestCreatedAtMs);
                return currentDistance < closestDistance ? task : closest;
            }, undefined);
            if (!selectedTask) {
                return null;
            }

            const doneAt = new Date().toISOString();
            await repository.markTaskHistoryDone(db, selectedTask.id, doneAt);
            console.info("[tasks] auto-marked task done for removable worktree", {
                worktreePath,
                projectId: matchingProject.projectId,
                taskId: selectedTask.id,
                doneAt,
                repositoryUrl: matchingProject.repositoryUrl,
            });

            return {
                id: selectedTask.id,
                projectId: selectedTask.projectId,
                prompt: selectedTask.prompt,
                createdAt: selectedTask.createdAt,
                isDone: true,
                doneAt,
            };
        },
    };
}
