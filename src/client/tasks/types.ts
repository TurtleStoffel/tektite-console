export type TaskItem = {
    id: string;
    sortOrder: number;
    projectId: string | null;
    description: string;
    isDone: boolean;
    doneAt: string | null;
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
