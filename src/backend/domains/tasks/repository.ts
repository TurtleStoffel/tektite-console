import { and, asc, eq, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import { projects, projectTasks, taskCanvasPositions, tasks } from "../../db/local/schema";
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
            sortOrder: tasks.sortOrder,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
            canvasPositionX: taskCanvasPositions.x,
            canvasPositionY: taskCanvasPositions.y,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .leftJoin(taskCanvasPositions, eq(taskCanvasPositions.taskId, tasks.id))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id))
        .execute();
}

export async function getNextTaskSortOrder() {
    const db = getDb();
    const rows = await db
        .select({
            nextSortOrder: sql<number>`coalesce(max(${tasks.sortOrder}), -1024) + 1024`,
        })
        .from(tasks)
        .execute();
    return rows[0]?.nextSortOrder ?? 0;
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
            sortOrder: tasks.sortOrder,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
            canvasPositionX: taskCanvasPositions.x,
            canvasPositionY: taskCanvasPositions.y,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .leftJoin(taskCanvasPositions, eq(taskCanvasPositions.taskId, tasks.id))
        .where(whereParts.length === 0 ? undefined : and(...whereParts))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id))
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
            sortOrder: tasks.sortOrder,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
            canvasPositionX: taskCanvasPositions.x,
            canvasPositionY: taskCanvasPositions.y,
        })
        .from(tasks)
        .innerJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .leftJoin(taskCanvasPositions, eq(taskCanvasPositions.taskId, tasks.id))
        .where(whereClause)
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id))
        .execute();
}

export async function findTaskById(taskId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: tasks.id,
            sortOrder: tasks.sortOrder,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
            canvasPositionX: taskCanvasPositions.x,
            canvasPositionY: taskCanvasPositions.y,
        })
        .from(tasks)
        .leftJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .leftJoin(taskCanvasPositions, eq(taskCanvasPositions.taskId, tasks.id))
        .where(eq(tasks.id, taskId))
        .execute();
    return rows[0] ?? null;
}

export function listTasksByWorktreePath(worktreePath: string) {
    const db = getDb();
    return db
        .select({
            id: tasks.id,
            sortOrder: tasks.sortOrder,
            projectId: projectTasks.projectId,
            description: tasks.description,
            createdAt: tasks.createdAt,
            isDone: tasks.isDone,
            doneAt: tasks.doneAt,
            canvasPositionX: taskCanvasPositions.x,
            canvasPositionY: taskCanvasPositions.y,
        })
        .from(tasks)
        .innerJoin(projectTasks, eq(projectTasks.taskId, tasks.id))
        .leftJoin(taskCanvasPositions, eq(taskCanvasPositions.taskId, tasks.id))
        .where(eq(projectTasks.worktreePath, worktreePath))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id))
        .execute();
}

export async function createTask(values: {
    id: string;
    projectId: string | null;
    description: string;
    createdAt: string;
    sortOrder: number;
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
                sortOrder: values.sortOrder,
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

export async function updateTaskSortOrder(input: { taskId: string; sortOrder: number }) {
    const db = getDb();
    return db
        .update(tasks)
        .set({ sortOrder: input.sortOrder })
        .where(eq(tasks.id, input.taskId))
        .returning({ id: tasks.id })
        .execute();
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

export async function updateTaskProject(input: { taskId: string; projectId: string | null }) {
    const db = getDb();
    await db.transaction(async (tx) => {
        await tx.delete(projectTasks).where(eq(projectTasks.taskId, input.taskId)).execute();

        if (input.projectId) {
            await tx
                .insert(projectTasks)
                .values({
                    taskId: input.taskId,
                    projectId: input.projectId,
                })
                .execute();
        }
    });
}

export async function upsertTaskCanvasPosition(input: { taskId: string; x: number; y: number }) {
    const db = getDb();
    await db
        .insert(taskCanvasPositions)
        .values({
            taskId: input.taskId,
            x: input.x,
            y: input.y,
            updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: taskCanvasPositions.taskId,
            set: {
                x: input.x,
                y: input.y,
                updatedAt: new Date().toISOString(),
            },
        })
        .execute();
}
