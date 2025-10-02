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

  const message =
    body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : typeof body === "string" && body.trim().length > 0
        ? body
        : res.statusText;

  throw new ApiError(res.status, body, message);
}

export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: any;
  } = { method: "GET" },
): Promise<Response> {
  const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;
  
  const res = await fetch(buildApiUrl(url), {
    method: options.method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(buildApiUrl(queryKey.join("/") as string), {
      credentials: "include",
    });

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
