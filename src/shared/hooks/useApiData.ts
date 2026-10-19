import { useCallback, useEffect, useState } from "react";

interface ApiEnvelope<T> {
    status: boolean;
    data: T;
}

export function useApiData<T>(apiCall: () => Promise<ApiEnvelope<T>>, deps: unknown[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await apiCall();
            if (response.status) {
                setData(response.data);
            } else {
                setError("Failed to load data.");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch, setData };
}
