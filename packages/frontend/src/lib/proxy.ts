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
  public readonly data?: any;

  constructor(status: number, statusText: string) {
    super(`Server-side HTTP Error: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

export async function proxyfetch(
  url: string | URL,
  options: RequestInit
): Promise<Response> {
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
  });
  if (!response.ok) {
    // definitely client-side http error (not backend error)
    throw new ClientSideHttpError(response.status, response.statusText);
  }

  const data = await response.json();
  if (!data.ok && data.error) {
    // backend unexpected error
    throw new ServerSideHttpError(data.status, data.error);
  }

  const r = new Response(
    typeof data.data === "string" ? data.data : JSON.stringify(data.data),
    {
      status: data.status,
      statusText: data.statusText,
      headers: data.headers,
    }
  );

  return r;
}
