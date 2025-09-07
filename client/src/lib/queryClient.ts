import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const baseUrl = getApiBaseUrl();
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    console.log('🌐 API Mutation:', fullUrl);
    
    const res = await fetch(fullUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error('🚨 API Mutation failed:', error);
    throw error;
  }
}

// Get API base URL - works both locally and on Vercel
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  
  const { hostname, protocol } = window.location;
  
  // Production Vercel domain
  if (hostname.includes('vercel.app')) {
    return `${protocol}//${hostname}`;
  }
  
  // Local development
  if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.includes('replit')) {
    return `${protocol}//${hostname}:5000`;
  }
  
  // Default fallback
  return `${protocol}//${hostname}`;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}${queryKey.join("/")}`;
      
      console.log('🌐 API Request:', url);
      
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error('🚨 API Request failed:', error);
      // Return empty array for failed requests to prevent crashes
      return [];
    }
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
