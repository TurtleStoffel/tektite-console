import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { FeatureFlag } from "@/shared/featureFlags";
import { getErrorMessage } from "./utils/errors";

type FeatureFlagsPageProps = {
    drawerToggleId: string;
};

export function FeatureFlagsPage({ drawerToggleId }: FeatureFlagsPageProps) {
    const [createKey, setCreateKey] = useState("");
    const [createDescription, setCreateDescription] = useState("");
    const [createEnabled, setCreateEnabled] = useState(false);
    const queryClient = useQueryClient();

    const {
        data: flags = [],
        isLoading,
        isFetching,
        error: loadErrorRaw,
        refetch,
    } = useQuery<FeatureFlag[]>({
        queryKey: ["feature-flags"],
        queryFn: async () => {
            console.info("[feature-flags] loading feature flags...");
            const res = await fetch("/api/feature-flags");
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to load feature flags.");
            }
            const data = Array.isArray(payload?.data) ? (payload.data as FeatureFlag[]) : [];
            console.info("[feature-flags] loaded feature flags", { count: data.length });
            return data;
        },
    });

    const createMutation = useMutation<
        FeatureFlag,
        Error,
        Omit<FeatureFlag, "createdAt" | "updatedAt">
    >({
        mutationFn: async (input) => {
            const res = await fetch("/api/feature-flags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to save feature flag.");
            }
            return payload.data as FeatureFlag;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
            setCreateKey("");
            setCreateDescription("");
            setCreateEnabled(false);
        },
    });

    const toggleMutation = useMutation<FeatureFlag, Error, string>({
        mutationFn: async (key: string) => {
            const res = await fetch(`/api/feature-flags/${encodeURIComponent(key)}/toggle`, {
                method: "POST",
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to toggle feature flag.");
            }
            return payload.data as FeatureFlag;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
        },
    });

    const loadError = getErrorMessage(loadErrorRaw);
    const createError = getErrorMessage(createMutation.error);
    const toggleError = getErrorMessage(toggleMutation.error);

    const onCreate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        createMutation.mutate({
            key: createKey.trim(),
            description: createDescription.trim(),
            isEnabled: createEnabled,
        });
    };

    return (
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Feature Flags</h1>
                    <p className="text-sm text-base-content/70">
                        Centralized flags persisted to the local database for future service
                        toggles.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void refetch()}
                        disabled={isLoading || isFetching}
                    >
                        {isLoading || isFetching ? "Refreshing..." : "Refresh"}
                    </button>
                    <Link to="/" className="btn btn-outline btn-sm">
                        Back to projects
                    </Link>
                    <label htmlFor={drawerToggleId} className="btn btn-outline btn-sm lg:hidden">
                        Menu
                    </label>
                </div>
            </div>

            {(loadError || createError || toggleError) && (
                <div className="alert alert-error text-sm">
                    <span>{loadError ?? createError ?? toggleError}</span>
                </div>
            )}

            <div className="card bg-base-200 border border-base-300 shadow-md">
                <div className="card-body space-y-4">
                    <h2 className="card-title">Create or update flag</h2>
                    <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={onCreate}>
                        <input
                            className="input input-bordered"
                            placeholder="flag.key"
                            value={createKey}
                            onChange={(event) => setCreateKey(event.target.value)}
                        />
                        <input
                            className="input input-bordered md:col-span-2"
                            placeholder="Description of what this toggles"
                            value={createDescription}
                            onChange={(event) => setCreateDescription(event.target.value)}
                        />
                        <div className="flex items-center justify-between gap-2">
                            <label className="label cursor-pointer gap-2">
                                <span className="label-text">Enabled</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary"
                                    checked={createEnabled}
                                    onChange={(event) => setCreateEnabled(event.target.checked)}
                                />
                            </label>
                            <button type="submit" className="btn btn-primary btn-sm">
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="overflow-x-auto card bg-base-200 border border-base-300 shadow-md">
                <table className="table table-zebra">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Description</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {flags.map((flag) => (
                            <tr key={flag.key}>
                                <td className="font-mono text-xs">{flag.key}</td>
                                <td className="text-sm">{flag.description}</td>
                                <td>
                                    <span
                                        className={`badge ${flag.isEnabled ? "badge-success" : "badge-ghost"}`}
                                    >
                                        {flag.isEnabled ? "Enabled" : "Disabled"}
                                    </span>
                                </td>
                                <td className="text-xs text-base-content/70">
                                    {new Date(flag.updatedAt).toLocaleString()}
                                </td>
                                <td className="text-right">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline"
                                        onClick={() => toggleMutation.mutate(flag.key)}
                                    >
                                        Toggle
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!isLoading && flags.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-sm text-base-content/70">
                                    No feature flags yet. Create the first one above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
