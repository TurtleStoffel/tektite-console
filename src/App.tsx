import "./index.css";

export function App() {
    const cells = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <div className="max-w-6xl w-full mx-auto p-8 text-center space-y-8 relative z-10">
            <header className="space-y-2">
                <h1 className="text-5xl font-bold leading-tight">Grid Layout</h1>
                <p className="text-base-content/80">
                    A 3 × 4 grid of cards, ready for whatever content you want to drop in.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cells.map((cell) => (
                    <div
                        key={cell}
                        className="card bg-base-200 border border-base-300 shadow-md hover:shadow-xl transition-shadow duration-200"
                    >
                        <div className="card-body text-left space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="badge badge-outline">Cell {cell}</span>
                                <span className="text-base-content/60">Ready</span>
                            </div>
                            <h2 className="card-title">Grid Item {cell}</h2>
                            <p className="text-sm text-base-content/70">
                                Placeholder for upcoming instructions and content.
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default App;
