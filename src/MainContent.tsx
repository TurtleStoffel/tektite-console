import { Link } from "react-router-dom";

type MainContentProps = {
    drawerToggleId: string;
};

export function MainContent({ drawerToggleId }: MainContentProps) {
    const cells = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <div className="flex items-center justify-between">
                <header className="space-y-2 text-left">
                    <h1 className="text-5xl font-bold leading-tight">Grid Layout</h1>
                    <p className="text-base-content/80">
                        A 3 × 4 grid of cards, ready for whatever content you want to drop in.
                    </p>
                </header>
                <div className="flex items-center gap-2">
                    <Link to="/editor" className="btn btn-primary btn-sm">
                        Node editor
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cells.map((cell) => (
                    <div
                        key={cell}
                        className="card bg-base-200 border border-base-300 shadow-md"
                    >
                        <div className="card-body text-left space-y-2">
                            <h2 className="card-title">Cell {cell}</h2>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default MainContent;
