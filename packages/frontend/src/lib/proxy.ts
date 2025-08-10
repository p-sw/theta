export class ClientSideHttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`Client-side HTTP Error: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

export class ServerSideHttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data?: unknown;

  constructor(status: number, statusText: string) {
    super(`Server-side HTTP Error: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

interface HostLimiter {
  activeRequests: number;
  queue: Array<() => void>;
}

const hostLimiters = new Map<string, HostLimiter>();

const getNumberFromEnv = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MAX_RETRIES = getNumberFromEnv(import.meta.env.VITE_PROXY_MAX_RETRIES, 4);
const BASE_DELAY_MS = getNumberFromEnv(
  import.meta.env.VITE_PROXY_RETRY_BASE_DELAY_MS,
  500
);
const MAX_CONCURRENCY = getNumberFromEnv(
  import.meta.env.VITE_PROXY_MAX_CONCURRENCY,
  4
);

function getLimiter(host: string): HostLimiter {
  let limiter = hostLimiters.get(host);
  if (!limiter) {
    limiter = { activeRequests: 0, queue: [] };
    hostLimiters.set(host, limiter);
  }
  return limiter;
}

// await delay, but support aborting
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      clearTimeout(id);
      if (signal) signal.removeEventListener("abort", onAbort);
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function withHostConcurrency<T>(
  host: string,
  task: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const limiter = getLimiter(host);
  if (limiter.activeRequests >= MAX_CONCURRENCY) {
    // Wait for slot
    await new Promise<void>((resolve, reject) => {
      const proceed = () => resolve();
      limiter.queue.push(proceed);
      if (signal) {
        const onAbort = () => {
          // Remove queued proceed if still present
          const idx = limiter.queue.indexOf(proceed);
          if (idx >= 0) limiter.queue.splice(idx, 1);
          signal.removeEventListener("abort", onAbort);
          reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  limiter.activeRequests++;
  try {
    return await task();
  } finally {
    limiter.activeRequests--;
    const next = limiter.queue.shift();
    if (next) next();
  }
}

function isRetriableStatus(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status !== 501) return true;
  return false;
}

function computeBackoffMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
    const dateTs = Date.parse(retryAfter);
    if (!Number.isNaN(dateTs)) return Math.max(0, dateTs - Date.now());
  }
  const cap = 8000; // 8s cap per attempt
  const exp = Math.min(cap, BASE_DELAY_MS * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

export async function proxyfetch(
  url: string | URL,
  options: Omit<RequestInit, "body"> & {
    body?: Record<string, unknown>;
    signal?: AbortSignal;
  }
): Promise<Response> {
  const backendUrl = new URL(import.meta.env.VITE_BACKEND_URL);
  backendUrl.pathname = "/proxy";

  const targetUrl = new URL(url.toString());
  const hostKey: string = targetUrl.host;

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const response = await withHostConcurrency(
        hostKey,
        async () => {
          return await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: url.toString(),
              method: options.method,
              headers: options.headers,
              data: options.body,
            }),
            signal: options.signal,
          });
        },
        options.signal
      );

      if (!response.ok) {
        const isProxied = response.headers.get("x-theta-proxied") === "true";

        if (
          isProxied &&
          isRetriableStatus(response.status) &&
          attempt < MAX_RETRIES
        ) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = computeBackoffMs(attempt, retryAfter);
          await delay(waitMs, options.signal);
          attempt++;
          continue;
        }

        if (!isProxied) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              const errorData = await response.json();
              throw new ServerSideHttpError(
                response.status,
                (errorData as any).proxyerror
              );
            } catch (e) {
              console.error("Error parsing proxy error response:", e);
              throw e;
            }
          }
        }

        // Return provider response (non-ok) to let provider-specific ensureSuccess handle it
        return response;
      }

      return response;
    } catch (e) {
      // If aborted, just propagate
      if (e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
      // Network/client error – retry with backoff if attempts remain
      if (attempt < MAX_RETRIES) {
        const waitMs = computeBackoffMs(attempt);
        await delay(waitMs, options.signal);
        attempt++;
        continue;
      }
      console.error("Error proxying request:", e);
      throw e;
    }
  }

  // Should not reach here; safeguard
  throw new ClientSideHttpError(500, "Exceeded max retries without response");
}
