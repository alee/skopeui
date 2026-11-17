export async function requestJson<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const responseData = await response
      .json()
      .catch(() => ({ detail: [{ msg: response.statusText }] }));
    const error = new Error(
      `Request failed with status ${response.status}`,
    ) as Error & {
      response?: { status: number; data: unknown; retryAfter?: number };
    };
    error.response = {
      status: response.status,
      data: responseData,
      retryAfter: Number(response.headers.get("Retry-After")) || undefined,
    };
    throw error;
  }

  return response.json() as Promise<T>;
}
