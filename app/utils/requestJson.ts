import { recordRequestDiagnostic } from "@/utils/requestDiagnostics";

export class RequestFailure extends Error {
  response?: { status: number; data: unknown; retryAfter?: number };
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RequestFailure";
  }
}

export function retryAfterSeconds(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds : undefined;
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp))
    return Math.max(0, (timestamp - Date.now()) / 1000);
}

/** Bounds fetch AND body reading, even when a transport fails to honor abort. */
export async function requestJson<T = unknown>(
  url: string,
  options: RequestInit = {},
  // deadline uses the monotonic performance clock, not the wall clock.
  budget: { timeoutMs?: number; deadline?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = Math.min(
    budget.timeoutMs ?? 15_000,
    budget.deadline == null ? Infinity : budget.deadline - performance.now(),
  );
  if (options.signal?.aborted)
    throw new RequestFailure("SUPERSEDED", "Extraction request superseded");
  if (timeout <= 0)
    throw new RequestFailure(
      "HTTP_TIMEOUT",
      "The connection deadline was reached.",
    );
  const operationDeadline = performance.now() + timeout;
  function checkDeadline() {
    if (performance.now() >= operationDeadline) {
      controller.abort();
      throw new RequestFailure(
        "HTTP_TIMEOUT",
        "The server connection took too long. Please try again.",
      );
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new RequestFailure("SUPERSEDED", "Extraction request superseded"));
      controller.abort();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      reject(
        new RequestFailure(
          "HTTP_TIMEOUT",
          "The server connection took too long. Please try again.",
        ),
      );
      controller.abort();
    }, timeout);
  });
  let status: number | undefined;
  let requestId: string | undefined;
  let errorCode: string | undefined;
  const operation = async () => {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    status = response.status;
    const correlationId = response.headers.get("X-Request-ID");
    requestId =
      correlationId && /^[0-9a-f]{32}$/.test(correlationId)
        ? correlationId
        : undefined;
    checkDeadline();
    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({ detail: [{ msg: response.statusText }] }));
      checkDeadline();
      const detail = data?.detail;
      const code =
        typeof detail?.code === "string" ? detail.code : "HTTP_ERROR";
      const error = new RequestFailure(
        code,
        typeof detail?.msg === "string"
          ? detail.msg
          : `Request failed with status ${response.status}`,
      );
      error.response = {
        status: response.status,
        data,
        retryAfter: retryAfterSeconds(response.headers.get("Retry-After")),
      };
      throw error;
    }
    const data = (await response.json()) as T;
    checkDeadline();
    return data;
  };
  try {
    return await Promise.race([operation(), interrupted]);
  } catch (error) {
    errorCode = error instanceof RequestFailure ? error.code : "NETWORK_ERROR";
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure(
      "NETWORK_ERROR",
      "Unable to reach the server. Please check your connection and try again.",
      { cause: error },
    );
  } finally {
    recordRequestDiagnostic(url, { status, requestId, errorCode });
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
