import { useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
} from "reactflow";
import "reactflow/dist/style.css";

type NodeEditorProps = {
    drawerToggleId: string;
};

const initialNodes: Node[] = [
    {
        id: "start",
        type: "input",
        position: { x: 80, y: 120 },
        data: { label: "Start" },
    },
    {
        id: "step",
        position: { x: 340, y: 120 },
        data: { label: "Step" },
    },
    {
        id: "end",
        type: "output",
        position: { x: 600, y: 120 },
        data: { label: "End" },
    },
];

const initialEdges: Edge[] = [
    { id: "e-start-step", source: "start", target: "step" },
    { id: "e-step-end", source: "step", target: "end" },
];

export function NodeEditor({ drawerToggleId }: NodeEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const nextNodeId = useRef(1);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((current) => addEdge(connection, current));
        },
        [setEdges],
    );

    const handleAddNode = useCallback(() => {
        const id = `node-${nextNodeId.current++}`;
        const sequence = nextNodeId.current - 1;
        setNodes((current) => [
            ...current,
            {
                id,
                position: { x: 160 + current.length * 30, y: 280 + (current.length % 4) * 80 },
                data: { label: `Node ${sequence}` },
            },
        ]);
    }, [setNodes]);

    const miniMapStyle = useMemo(() => ({ height: 120 }), []);

    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="max-w-6xl w-full mx-auto px-8 pt-8 pb-4 flex items-start justify-between gap-4">
                <div className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Node Editor</h1>
                    <p className="text-base-content/80">A simple React Flow canvas for node-based editing.</p>
                    <div className="flex items-center gap-2">
                        <Link to="/" className="btn btn-outline btn-sm">
                            Back to grid
                        </Link>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleAddNode}>
                            Add node
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <div className="flex-1 w-full">
                <div className="max-w-6xl w-full mx-auto px-8 pb-8 h-full">
                    <div className="card bg-base-200 border border-base-300 shadow-md h-[70vh] min-h-[520px]">
                        <div className="card-body p-0">
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                fitView
                            >
                                <MiniMap style={miniMapStyle} zoomable pannable />
                                <Controls />
                                <Background />
                            </ReactFlow>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NodeEditor;
