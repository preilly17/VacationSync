import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./api";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const generateRequestId = (): string => {
  try {
    if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      if (typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }
    }
  } catch {
    // ignore
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

async function throwIfResNotOk(res: Response) {
  if (res.ok) {
    return;
  }

  let responseText: string | null = null;
  let parsedData: unknown = null;

  try {
    responseText = await res.text();
    if (responseText) {
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = responseText;
      }
    }
  } catch {
    responseText = null;
    parsedData = null;
  }

  const body = parsedData ?? responseText ?? null;

  if (
    res.status === 401 &&
    body &&
    typeof body === "object" &&
    ("redirectToLogin" in body || "clearSession" in body)
  ) {
    console.log("Session expired - manual refresh required");
  }

  const message = (() => {
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string" &&
      (body as { error: string }).error.trim().length > 0
    ) {
      return (body as { error: string }).error;
    }

    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }

    if (typeof body === "string" && body.trim().length > 0) {
      return body;
    }

    return res.statusText;
  })();

  throw new ApiError(res.status, body, message);
}

export async function apiRequest<T = any>(
  url: string,
  options: {
    method: string;
    body?: any;
    headers?: Record<string, string>;
  } = { method: "GET" },
): Promise<T> {
  const body =
    options.body !== undefined
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

  const baseHeaders: Record<string, string> = body ? { "Content-Type": "application/json" } : {};
  const headers = { ...baseHeaders, ...(options.headers ?? {}) };
  if (!headers["X-Request-ID"] && !headers["x-request-id"]) {
    headers["X-Request-ID"] = generateRequestId();
  }

  try {
    const res = await fetch(buildApiUrl(url), {
      method: options.method,
      headers,
      body,
      credentials: "include",
    });

    await throwIfResNotOk(res);

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const redirectedPath = (() => {
        try {
          return new URL(res.url).pathname;
        } catch {
          return "";
        }
      })();

      const isAuthRedirect = res.redirected && redirectedPath.includes("/login");
      throw new ApiError(
        isAuthRedirect ? 401 : res.status || 500,
        null,
        isAuthRedirect
          ? "Unauthorized"
          : "API returned HTML instead of JSON",
      );
    }

    const hasJson = contentType.includes("application/json");
    const isEmptyResponse = res.status === 204;
    const parsedBody = isEmptyResponse
      ? (undefined as T)
      : hasJson
        ? ((await res.json()) as T)
        : ((await res.text()) as unknown as T);

    console.log("HTTP response", options.method, url, res.status);
    return parsedBody;
  } catch (error) {
    console.error("HTTP error", options.method, url, error);
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error("We couldn’t reach the server. Check your connection and try again.");
    }

    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey.join("/") as string;
    const res = await fetch(buildApiUrl(endpoint), {
      credentials: "include",
    });

    if (!res.ok) {
      console.error("HTTP error", "GET", endpoint, res.status);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Check if response is HTML (development server issue)
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn('API returned HTML instead of JSON for:', queryKey.join("/"));
      // For auth/user endpoint, return null to indicate not authenticated
      if (queryKey.join("/").includes('/api/auth/user')) {
        return null;
      }
      throw new Error('API returned HTML instead of JSON');
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
