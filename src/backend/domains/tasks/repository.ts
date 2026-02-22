import { and, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { projects, projectTasks, tasks } from "../../db/local/schema";
import { getDb } from "../../db/provider";

export async function findProject(projectId: string) {
    const db = getDb();
    const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .execute();
    return rows[0] ?? null;
}

export function listTasks() {
    const db = getDb();
    return db
        .select({
            id: tasks.id,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .execute();
}

export function listTasksWithFilter(filter: { isDone?: boolean; hasProject?: boolean } = {}) {
    const db = getDb();
    const whereParts: SQL[] = [];

    if (filter.isDone !== undefined) {
        whereParts.push(eq(tasks.isDone, filter.isDone));
    }
    if (filter.hasProject === true) {
        whereParts.push(isNotNull(projectTasks.taskId));
    }
    if (filter.hasProject === false) {
        whereParts.push(isNull(projectTasks.taskId));
    }

    return db
        .select({
            id: tasks.id,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .where(whereParts.length === 0 ? undefined : and(...whereParts))
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .execute();
}

export function listProjectTasks(projectId: string, filter: { isDone?: boolean } = {}) {
    const db = getDb();
    const whereClause =
        filter.isDone === undefined
            ? eq(projectTasks.projectId, projectId)
            : and(eq(projectTasks.projectId, projectId), eq(tasks.isDone, filter.isDone));

    return db
        .select({
            id: tasks.id,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
        })
        .from(tasks)
        .innerJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .where(whereClause)
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .execute();
}

export async function findTaskById(taskId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: tasks.id,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .where(eq(tasks.id, taskId))
        .execute();
    return rows[0] ?? null;
}

export async function createTask(values: {
    id: string;
    projectId: string | null;
    description: string;
    createdAt: string;
    isDone: boolean;
    doneAt: string | null;
}) {
    const db = getDb();
    await db.transaction(async (tx) => {
        await tx
            .insert(tasks)
            .values({
                id: values.id,
                description: values.description,
                createdAt: values.createdAt,
                isDone: values.isDone,
                doneAt: values.doneAt,
            })
            .execute();

        if (values.projectId) {
            await tx
                .insert(projectTasks)
                .values({
                    projectId: values.projectId,
                    taskId: values.id,
                })
                .execute();
        }
    });
}

export async function markTaskDone(taskId: string, doneAt: string) {
    const db = getDb();
    await db
        .update(tasks)
        .set({
            isDone: true,
            doneAt,
        })
        .where(eq(tasks.id, taskId))
        .execute();
}

export async function setTaskWorktreePath(taskId: string, worktreePath: string) {
    const db = getDb();
    await db
        .update(projectTasks)
        .set({
            worktreePath,
        })
        .where(eq(projectTasks.taskId, taskId))
        .execute();
}

export async function deleteTask(taskId: string) {
    const db = getDb();
    await db.delete(tasks).where(eq(tasks.id, taskId)).execute();
}
