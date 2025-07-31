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

export async function proxyfetch(
  url: string | URL,
  options: Omit<RequestInit, "body"> & {
    body?: Record<string, unknown>;
    signal?: AbortSignal;
  }
): Promise<Response> {
  try {
    const requestUrl = new URL(import.meta.env.VITE_BACKEND_URL);
    requestUrl.pathname = "/proxy";
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url.toString(),
        method: options.method,
        headers: options.headers,
        data: options.body,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (
        contentType &&
        contentType.includes("application/json") &&
        response.headers.get("X-Theta-Proxy-Error") === "true"
      ) {
        // proxy-side error
        try {
          const errorData = await response.json();
          throw new ServerSideHttpError(response.status, errorData.proxyerror);
        } catch (e) {
          // If JSON parsing fails, fall through to client-side error
          // but i guess never happens
          console.error("Error parsing proxy error response:", e);
          throw e;
        }
      }
      // It's other error, including provider-side error
      // just returning is enough
    }

    return response;
  } catch (e) {
    // client-side http error
    console.error("Error proxying request:", e);
    throw e;
  }
}
