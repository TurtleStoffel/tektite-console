import { stat } from "node:fs/promises";
import path from "node:path";
import madge from "madge";
import { Result } from "typescript-result";

type DependencyNode = {
    id: string;
    label: string;
    outgoingCount: number;
    incomingCount: number;
};

type DependencyEdge = {
    from: string;
    to: string;
};

type DependencyGraphData = {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
};

type DependencyDomainError =
    | {
          type: "dependency-path-required";
          message: string;
      }
    | {
          type: "dependency-path-not-found";
          message: string;
      }
    | {
          type: "dependency-graph-error";
          message: string;
          cause?: unknown;
      };

async function validateAndResolvePath(
    rawTargetPath: string,
): Promise<Result<string, DependencyDomainError>> {
    const normalizedPath = rawTargetPath.trim();
    if (!normalizedPath) {
        return Result.error({
            type: "dependency-path-required",
            message: "Path query parameter is required.",
        });
    }

    const targetPath = path.resolve(normalizedPath);
    const existsResult = await Result.try(
        () => stat(targetPath),
        () =>
            ({
                type: "dependency-path-not-found",
                message: "Target path does not exist.",
            }) as const,
    );
    if (!existsResult.ok) {
        return Result.error(existsResult.error);
    }

    return Result.ok(targetPath);
}

function buildGraphDataFromObject(dependencyObject: Record<string, string[]>): DependencyGraphData {
    const allModuleIds = new Set<string>(Object.keys(dependencyObject));
    for (const imports of Object.values(dependencyObject)) {
        for (const importedModule of imports) {
            allModuleIds.add(importedModule);
        }
    }

    const edges: DependencyEdge[] = [];
    const outgoingCountByModule = new Map<string, number>();
    const incomingCountByModule = new Map<string, number>();
    for (const moduleId of allModuleIds) {
        outgoingCountByModule.set(moduleId, 0);
        incomingCountByModule.set(moduleId, 0);
    }

    for (const [from, imports] of Object.entries(dependencyObject)) {
        outgoingCountByModule.set(from, imports.length);
        for (const to of imports) {
            edges.push({ from, to });
            incomingCountByModule.set(to, (incomingCountByModule.get(to) ?? 0) + 1);
        }
    }

    const nodes = Array.from(allModuleIds)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({
            id,
            label: path.basename(id),
            outgoingCount: outgoingCountByModule.get(id) ?? 0,
            incomingCount: incomingCountByModule.get(id) ?? 0,
        }));

    return { nodes, edges };
}

export function createDependencyService() {
    return {
        async generateGraphData(rawTargetPath: string) {
            const targetPathResult = await validateAndResolvePath(rawTargetPath);
            if (!targetPathResult.ok) {
                return Result.error(targetPathResult.error);
            }
            const targetPath = targetPathResult.value;

            console.info("[dependencies] generating madge graph", { targetPath });

            const madgeResult = await Result.try(
                async () => {
                    const result = await madge(targetPath, {
                        fileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
                        includeNpm: false,
                    });
                    return buildGraphDataFromObject(result.obj());
                },
                (error) => {
                    console.warn("[dependencies] madge graph generation failed", {
                        targetPath,
                        error,
                    });
                    return {
                        type: "dependency-graph-error",
                        message: "Failed to generate dependency data with Madge.",
                        cause: error,
                    } as const;
                },
            );
            if (!madgeResult.ok) {
                return Result.error(madgeResult.error);
            }

            return Result.ok(madgeResult.value);
        },
    };
}
