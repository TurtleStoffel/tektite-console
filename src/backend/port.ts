export function isPortFree(port: number): boolean {
    const canBind = (hostname: string) => {
        try {
            const server = Bun.listen({
                port,
                hostname,
                socket: {
                    data() {},
                },
            });

            server.stop(); // immediately free it
            return true;
        } catch (error) {
            if (
                hostname === "::" &&
                error instanceof Error &&
                /EAFNOSUPPORT|Address family not supported/i.test(error.message)
            ) {
                return true;
            }

            return false; // Bun.listen threw → port is in use (or not bindable)
        }
    };

    return canBind("0.0.0.0") && canBind("::");
}

export function findFirstFreePort(lowerBound: number, options?: { maxPort?: number }): number {
    const maxPort = options?.maxPort ?? 65535;
    const startPort = Number.isFinite(lowerBound) ? Math.trunc(lowerBound) : 0;

    if (startPort < 1 || startPort > 65535) {
        throw new Error(`Invalid port lower bound: ${lowerBound}`);
    }

    for (let port = startPort; port <= maxPort; port += 1) {
        if (isPortFree(port)) return port;
    }

    throw new Error(`No free port found from ${startPort} to ${maxPort}`);
}
