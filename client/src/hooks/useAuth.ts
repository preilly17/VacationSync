import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { buildApiUrl } from "@/lib/api";

export function useAuth() {
  const isMountedRef = useRef(true);
  const [manualLoading, setManualLoading] = useState(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data: user, isLoading: queryLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    // FIXED USER REQUEST: ensure the auth lookup never leaves the UI stuck in loading
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const cleanupLinkedSignal = linkAbortSignals(signal, controller);

      let cleanupTimeout: (() => void) | undefined;
      if (typeof window !== "undefined") {
        const timeoutId = window.setTimeout(() => {
          controller.abort(
            new DOMException("User request timed out", "AbortError"),
          );
        }, 10000);
        cleanupTimeout = () => window.clearTimeout(timeoutId);
      }

      if (isMountedRef.current) {
        setManualLoading(true); // FIXED USER REQUEST
      }

      try {
        const response = await fetch(buildApiUrl("/api/auth/user"), {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          const message = (await response.text()) || response.statusText;
          throw new Error(message);
        }

        return (await response.json()) as User;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") {
          console.warn("Auth user request aborted", error);
        } else {
          console.error("Failed to load authenticated user", error);
        }
        return null;
      } finally {
        cleanupLinkedSignal?.();
        cleanupTimeout?.();
        if (isMountedRef.current) {
          setManualLoading(false); // FIXED USER REQUEST
        }
      }
    },
    retry: (failureCount, error) => {
      if (error && typeof error === "object" && "message" in error) {
        if (typeof error.message === "string" && error.message.includes("401")) {
          return false;
        }
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  useEffect(() => {
    if (!queryLoading && isMountedRef.current) {
      setManualLoading(false); // FIXED USER REQUEST
    }
  }, [queryLoading]);

  return {
    user,
    isLoading: manualLoading,
    isAuthenticated: !!user,
  };
}

function linkAbortSignals(
  source: AbortSignal | undefined,
  targetController: AbortController,
) {
  if (!source) {
    return undefined;
  }

  if (source.aborted) {
    targetController.abort(source.reason);
    return undefined;
  }

  const listener = () => targetController.abort(source.reason);
  source.addEventListener("abort", listener);
  return () => source.removeEventListener("abort", listener);
}
