import * as repository from "./repository";

export const tasksDomainApi = {
    async createTaskConnection(input: { taskId: string; connectedTaskId: string }) {
        if (input.taskId === input.connectedTaskId) {
            return { error: "A task cannot connect to itself.", status: 400 as const };
        }

        const [task, connectedTask] = await Promise.all([
            repository.findTaskById(input.taskId),
            repository.findTaskById(input.connectedTaskId),
        ]);
        if (!task || !connectedTask) {
            return { error: "Task not found.", status: 404 as const };
        }

        const pair = {
            sourceTaskId: input.taskId,
            targetTaskId: input.connectedTaskId,
        };
        await repository.createTaskConnection(pair);
        console.info("[tasks] created task connection", pair);
        return pair;
    },

    async deleteTaskConnection(input: { taskId: string; connectedTaskId: string }) {
        if (input.taskId === input.connectedTaskId) {
            return { error: "A task cannot connect to itself.", status: 400 as const };
        }

        const [task, connectedTask] = await Promise.all([
            repository.findTaskById(input.taskId),
            repository.findTaskById(input.connectedTaskId),
        ]);
        if (!task || !connectedTask) {
            return { error: "Task not found.", status: 404 as const };
        }

        const pair = {
            sourceTaskId: input.taskId,
            targetTaskId: input.connectedTaskId,
        };
        await repository.deleteTaskConnection(pair);
        console.info("[tasks] deleted task connection", pair);
        return pair;
    },
};
