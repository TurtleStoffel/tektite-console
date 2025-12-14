export const envRoutes = {
    "/api/env": {
        async GET() {
            const nodeEnv = process.env.NODE_ENV;

            return Response.json({
                nodeEnv: nodeEnv ?? null,
                isProduction: nodeEnv === "production",
            });
        },
    },
} as const;

