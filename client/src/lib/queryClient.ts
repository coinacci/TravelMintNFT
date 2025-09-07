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

// Get API base URL - works locally, Replit, and Vercel
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  
  const { hostname, protocol, port } = window.location;
  
  console.log('🔍 URL Debug:', { hostname, protocol, port });
  
  // Production Vercel domain
  if (hostname.includes('vercel.app')) {
    return `${protocol}//${hostname}`;
  }
  
  // Replit development environment (any replit subdomain)
  if (hostname.includes('replit') || 
      hostname.includes('.dev') ||
      hostname.match(/^[a-f0-9\-]+\..*\.replit/)) {
    // Replit serves both frontend and backend on same port with proxy
    const baseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
    console.log('🚀 Using Replit proxy URL:', baseUrl);
    return baseUrl;
  }
  
  // Local development (localhost, 127.x.x.x)
  if (hostname === 'localhost' || hostname.startsWith('127.')) {
    return `${protocol}//${hostname}:5000`;
  }
  
  // Default fallback - assume same domain
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
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(8000),
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      const baseUrl = getApiBaseUrl();
      const failedUrl = `${baseUrl}${queryKey.join("/")}`;
      console.error('🚨 API Request failed:', error);
      console.error('🚨 Failed URL was:', failedUrl);
      console.error('🚨 Error details:', {
        name: error.name,
        message: error.message,
        cause: error.cause
      });
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
