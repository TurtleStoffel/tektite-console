import type { z } from "zod";

export const jsonHeaders = { "Content-Type": "application/json" };

export function invalidRequestResponse(error: string, issues?: z.ZodIssue[]) {
    return new Response(JSON.stringify(issues ? { error, issues } : { error }), {
        status: 400,
        headers: jsonHeaders,
    });
}

export async function parseJsonBody<T extends z.ZodTypeAny>(options: {
    req: Request;
    schema: T;
    domain: string;
    context: string;
}): Promise<{ data: z.infer<T> } | { response: Response }> {
    let body: unknown;
    try {
        body = await options.req.json();
    } catch (error) {
        console.warn(`[${options.domain}] invalid json payload`, {
            context: options.context,
            error,
        });
        return { response: invalidRequestResponse("Invalid JSON payload.") };
    }

    const parsed = options.schema.safeParse(body);
    if (!parsed.success) {
        console.warn(`[${options.domain}] invalid request body`, {
            context: options.context,
            issues: parsed.error.issues,
        });
        return {
            response: invalidRequestResponse("Invalid request payload.", parsed.error.issues),
        };
    }

    return { data: parsed.data };
}

export function parseInput<T extends z.ZodTypeAny>(options: {
    input: unknown;
    schema: T;
    domain: string;
    context: string;
    errorMessage: string;
}): { data: z.infer<T> } | { response: Response } {
    const parsed = options.schema.safeParse(options.input);
    if (!parsed.success) {
        console.warn(`[${options.domain}] invalid request input`, {
            context: options.context,
            issues: parsed.error.issues,
        });
        return { response: invalidRequestResponse(options.errorMessage, parsed.error.issues) };
    }

    return { data: parsed.data };
}
