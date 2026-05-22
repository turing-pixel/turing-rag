import { getApiBase } from "@/lib/public-urls";
import { getLoginHrefFromPathname } from "@/lib/locale-path";

interface FetchOptions extends Omit<RequestInit, 'body' | 'headers'> {
  data?: any;
  headers?: Record<string, string>;
  /** Do not clear token or hard-redirect on 401 (login/register flows). */
  skipAuthRedirect?: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function redirectToLoginIfUnauthorized(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem("token");
  window.location.href = getLoginHrefFromPathname(window.location.pathname);
}

/** Normalize FastAPI / JSON error payloads into a single user-facing string. */
export function formatApiErrorMessage(
  errorData: Record<string, unknown>
): string {
  const detail = errorData.detail ?? errorData.message;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('; ');
    }
  }
  return 'An error occurred';
}

export async function parseHttpErrorResponse(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return `Request failed with status ${response.status}`;
  }
  try {
    return formatApiErrorMessage(JSON.parse(text) as Record<string, unknown>);
  } catch {
    return text;
  }
}

async function fetchApi(path: string, options: FetchOptions = {}) {
  const {
    data,
    headers: customHeaders = {},
    skipAuthRedirect = false,
    ...restOptions
  } = options;

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...customHeaders,
  };

  // If no content type is specified and we have data, default to JSON
  if (!headers['Content-Type'] && data && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...restOptions,
    headers,
  };

  // Handle body based on Content-Type
  if (data) {
    if (data instanceof FormData) {
      config.body = data;
    } else if (headers['Content-Type'] === 'application/json') {
      config.body = JSON.stringify(data);
    } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      config.body = typeof data === 'string' ? data : new URLSearchParams(data).toString();
    } else {
      config.body = data;
    }
  }

  try {
    const response = await fetch(`${getApiBase()}${path}`, config);

    if (response.status === 401) {
      if (!skipAuthRedirect) {
        redirectToLoginIfUnauthorized();
      }
      throw new ApiError(401, 'Unauthorized - Please log in again');
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      throw new ApiError(
        response.status,
        formatApiErrorMessage(errorData)
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const detail =
      error instanceof Error ? error.message : String(error);
    throw new ApiError(
      503,
      detail
        ? `Network error or server is unreachable (${detail})`
        : "Network error or server is unreachable"
    );
  }
}

// Helper methods for common HTTP methods
export const api = {
  get: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    fetchApi(url, { ...options, method: 'GET' }),

  post: (url: string, data?: any, options?: Omit<FetchOptions, 'method'>) =>
    fetchApi(url, { ...options, method: 'POST', data }),

  put: (url: string, data?: any, options?: Omit<FetchOptions, 'method'>) =>
    fetchApi(url, { ...options, method: 'PUT', data }),

  delete: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    fetchApi(url, { ...options, method: 'DELETE' }),

  patch: (url: string, data?: any, options?: Omit<FetchOptions, 'method'>) =>
    fetchApi(url, { ...options, method: 'PATCH', data }),
};
