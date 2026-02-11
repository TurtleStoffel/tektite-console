import { useEffect, useState } from "react";

type DrawerProps = {
    side: React.ReactNode;
    children: (drawerToggleId: string) => React.ReactNode;
    drawerToggleId?: string;
};

export function Drawer({ side, children, drawerToggleId = "sidebar-drawer" }: DrawerProps) {
    const [drawerWidth, setDrawerWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (!isResizing) return;
            const minWidth = 240;
            const maxWidth = 520;
            const nextWidth = Math.min(Math.max(event.clientX, minWidth), maxWidth);
            setDrawerWidth(nextWidth);
        };

        const handleMouseUp = () => setIsResizing(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div className="drawer lg:drawer-open" style={{ userSelect: isResizing ? "none" : "auto" }}>
            <input id={drawerToggleId} type="checkbox" className="drawer-toggle" />
            <div className="drawer-content">{children(drawerToggleId)}</div>

            <div className="drawer-side">
                <label
                    htmlFor={drawerToggleId}
                    className="drawer-overlay"
                    aria-label="close sidebar"
                ></label>
                <div
                    className="min-h-full bg-base-200 border-r border-base-300 p-6 space-y-6 relative"
                    style={{ width: `${drawerWidth}px` }}
                >
                    {side}
                    <button
                        type="button"
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            setIsResizing(true);
                        }}
                        aria-label="Resize drawer"
                    />
                </div>
            </div>
        </div>
    );
}

export default Drawer;
