export const helloRoutes = {
    "/api/hello": {
        async GET() {
            return Response.json({
                message: "Hello, world!",
                method: "GET",
            });
        },
        async PUT() {
            return Response.json({
                message: "Hello, world!",
                method: "PUT",
            });
        },
    },

    "/api/hello/:name": async (req: { params: { name: string } }) => {
        const name = req.params.name;
        return Response.json({
            message: `Hello, ${name}!`,
        });
    },
} as const;
