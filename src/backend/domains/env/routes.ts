import { createEnvService } from "./domainApi";

const service = createEnvService();

export const envRoutes = {
    "/api/env": {
        async GET() {
            return Response.json(service.getEnv());
        },
    },
} as const;
