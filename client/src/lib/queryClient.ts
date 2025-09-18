import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Check if it's a session expired error
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      throw new Error(`${res.status}: ${text}`);
    }
    
    // Temporarily disable automatic session handling to prevent loops
    // Users can manually refresh via the refresh button
    if (res.status === 401 && (errorData.redirectToLogin || errorData.clearSession)) {
      console.log("Session expired - manual refresh required");
      // Don't automatically redirect to prevent loops
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: any;
  } = { method: "GET" },
): Promise<Response> {
  const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;
  
  const res = await fetch(url, {
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
    const res = await fetch(queryKey.join("/") as string, {
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
