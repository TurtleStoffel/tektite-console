export type TaskItem = {
    id: string;
    sortOrder: number;
    projectId: string | null;
    description: string;
    state: "todo" | "in_progress" | "done";
    isDone: boolean;
    doneAt: string | null;
    connectionTaskIds: string[];
    canvasPosition: {
        x: number;
        y: number;
    } | null;
};

export type ProjectOption = {
    id: string;
    name: string | null;
};

export type CanvasPoint = {
    x: number;
    y: number;
};

export type Viewport = {
    x: number;
    y: number;
    scale: number;
};
