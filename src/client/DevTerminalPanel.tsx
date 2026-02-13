import { FitAddon } from "@xterm/addon-fit";
import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

type DevTerminalPanelProps = {
    sessionId: string;
};

export function DevTerminalPanel({ sessionId }: DevTerminalPanelProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const terminal = new Terminal({
            convertEol: true,
            cursorBlink: true,
            fontSize: 12,
            scrollback: 3000,
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        fitAddon.fit();

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const socket = new WebSocket(
            `${protocol}://${window.location.host}/api/worktrees/dev-terminal/ws?sessionId=${encodeURIComponent(sessionId)}`,
        );

        terminal.onData((data) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "input", data }));
            }
        });

        const onResize = () => {
            fitAddon.fit();
            socket.send(
                JSON.stringify({
                    type: "resize",
                    cols: terminal.cols,
                    rows: terminal.rows,
                }),
            );
        };
        window.addEventListener("resize", onResize);

        socket.onopen = () => {
            onResize();
        };

        socket.onmessage = (event) => {
            const payload = JSON.parse(event.data) as { type?: string; data?: string };
            if (payload.type === "output" && typeof payload.data === "string") {
                terminal.write(payload.data);
                return;
            }
            if (payload.type === "exit") {
                terminal.writeln("\r\n[system] process exited");
            }
        };

        socket.onclose = () => {
            terminal.writeln("\r\n[system] terminal disconnected");
        };

        return () => {
            window.removeEventListener("resize", onResize);
            socket.close();
            terminal.dispose();
        };
    }, [sessionId]);

    return (
        <div className="space-y-2">
            <div className="text-sm font-semibold">Dev terminal</div>
            <div className="border border-base-300 rounded-xl bg-black p-1">
                <div ref={containerRef} className="h-80 w-full" />
            </div>
        </div>
    );
}
