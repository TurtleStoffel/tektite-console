import type { Database } from "bun:sqlite";
import type { Server } from "bun";
import { randomUUID } from "node:crypto";

export function createFlowRoutes(options: { db: Database; defaultOwnerId: string }) {
    const { db, defaultOwnerId } = options;

    return {
        "/api/flow/:id": {
            async GET(req: Server.Request) {
                const flowKey = req.params.id;
                const flowRow = db.query("SELECT id FROM flows WHERE key = ?").get(flowKey) as
                    | { id: string }
                    | null
                    | undefined;
                if (!flowRow) {
                    return Response.json({ id: flowKey, state: null });
                }

                const nodeRows = db
                    .query("SELECT node_json, owner_id FROM flow_nodes WHERE flow_id = ?")
                    .all(flowRow.id) as Array<{ node_json: string; owner_id: string }>;
                const edgeRows = db
                    .query(
                        `
                        SELECT
                            e.key AS key,
                            sn.key AS source_key,
                            tn.key AS target_key,
                            e.source_handle AS source_handle,
                            e.target_handle AS target_handle,
                            e.edge_type AS edge_type
                        FROM flow_edges e
                        JOIN flow_nodes sn ON sn.id = e.source_node_id
                        JOIN flow_nodes tn ON tn.id = e.target_node_id
                        WHERE e.flow_id = ?
                        `,
                    )
                    .all(flowRow.id) as Array<{
                    key: string;
                    source_key: string;
                    target_key: string;
                    source_handle: string | null;
                    target_handle: string | null;
                    edge_type: string | null;
                }>;

                try {
                    const nodes = nodeRows
                        .map((row) => {
                            const node = JSON.parse(row.node_json) as any;
                            if (!node || typeof node !== "object") return null;
                            const data = node.data && typeof node.data === "object" ? node.data : {};
                            return {
                                ...node,
                                data: {
                                    ...data,
                                    ownerId: row.owner_id,
                                },
                            };
                        })
                        .filter((node) => node && typeof node === "object");
                    const edges = edgeRows.map((row) => {
                        const edge: Record<string, unknown> = {
                            id: row.key,
                            source: row.source_key,
                            target: row.target_key,
                        };
                        if (row.source_handle) edge.sourceHandle = row.source_handle;
                        if (row.target_handle) edge.targetHandle = row.target_handle;
                        if (row.edge_type) edge.type = row.edge_type;
                        return edge;
                    });
                    return Response.json({ id: flowKey, state: { nodes, edges } });
                } catch {
                    return Response.json({ id: flowKey, state: null });
                }
            },
            async PUT(req: Server.Request) {
                const flowKey = req.params.id;
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const nodes = body?.nodes;
                const edges = body?.edges;
                if (!Array.isArray(nodes) || !Array.isArray(edges)) {
                    return new Response(JSON.stringify({ error: "Payload must include nodes[] and edges[]." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                const persist = db.transaction(() => {
                    const existingFlow = db.query("SELECT id FROM flows WHERE key = ?").get(flowKey) as
                        | { id: string }
                        | null
                        | undefined;
                    const flowId = existingFlow?.id ?? randomUUID();

                    if (!existingFlow) {
                        db.query("INSERT INTO flows (id, key) VALUES (?, ?)").run(flowId, flowKey);
                    }

                    db.query("DELETE FROM flow_edges WHERE flow_id = ?").run(flowId);
                    db.query("DELETE FROM flow_nodes WHERE flow_id = ?").run(flowId);

                    const nodeUuidByKey = new Map<string, string>();
                    const insertNode = db.query(
                        "INSERT INTO flow_nodes (id, flow_id, key, owner_id, node_json) VALUES (?, ?, ?, ?, ?)",
                    );

                    for (const node of nodes) {
                        if (!node || typeof node !== "object") continue;
                        const nodeKey = (node as any).id;
                        if (typeof nodeKey !== "string" || !nodeKey) continue;
                        const ownerId =
                            typeof (node as any)?.data?.ownerId === "string"
                                ? (node as any).data.ownerId
                                : defaultOwnerId;
                        const nodeUuid = randomUUID();
                        nodeUuidByKey.set(nodeKey, nodeUuid);
                        insertNode.run(nodeUuid, flowId, nodeKey, ownerId, JSON.stringify(node));
                    }

                    const insertEdge = db.query(
                        `
                        INSERT INTO flow_edges (
                            id,
                            flow_id,
                            key,
                            source_node_id,
                            target_node_id,
                            source_handle,
                            target_handle,
                            edge_type
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                    );

                    for (const edge of edges) {
                        if (!edge || typeof edge !== "object") continue;
                        const edgeKey = (edge as any).id;
                        const sourceKey = (edge as any).source;
                        const targetKey = (edge as any).target;
                        if (typeof edgeKey !== "string" || !edgeKey) continue;
                        if (typeof sourceKey !== "string" || !sourceKey) continue;
                        if (typeof targetKey !== "string" || !targetKey) continue;

                        const sourceNodeId = nodeUuidByKey.get(sourceKey);
                        const targetNodeId = nodeUuidByKey.get(targetKey);
                        if (!sourceNodeId || !targetNodeId) {
                            throw new Error("Edges must reference existing nodes.");
                        }

                        const sourceHandle =
                            typeof (edge as any).sourceHandle === "string" ? (edge as any).sourceHandle : null;
                        const targetHandle =
                            typeof (edge as any).targetHandle === "string" ? (edge as any).targetHandle : null;
                        const edgeType = typeof (edge as any).type === "string" ? (edge as any).type : null;

                        insertEdge.run(
                            randomUUID(),
                            flowId,
                            edgeKey,
                            sourceNodeId,
                            targetNodeId,
                            sourceHandle,
                            targetHandle,
                            edgeType,
                        );
                    }
                });

                try {
                    persist();
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to persist flow state.";
                    return new Response(JSON.stringify({ error: message }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    });
                }

                return Response.json({ id: flowKey });
            },
        },
    } as const;
}

