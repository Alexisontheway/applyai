/**
 * Typed API client.
 *
 * The API always answers with `{ success, data }` or `{ success: false, error }`,
 * so unwrapping and error shaping happen here once instead of in every hook.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Pass a FormData instance to send multipart instead of JSON. */
  formData?: FormData;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal } = options;

  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: formData ? undefined : { 'content-type': 'application/json' },
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      `Request failed with status ${response.status}`;
    const error = new ApiError(
      message,
      response.status,
      (payload as { details?: unknown } | null)?.details,
    );

    // A dead session should drop the user back on the login screen rather than
    // showing an error on every panel.
    if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    throw error;
  }

  const data = (payload as { data?: unknown } | null)?.data;
  return (data ?? payload) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
