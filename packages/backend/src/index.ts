import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";

// Schema definition for proxy requests
const ProxyRequestSchema = t.Object({
  url: t.String(),
  method: t.Union([
    t.Literal("GET"),
    t.Literal("POST"),
    t.Literal("PUT"),
    t.Literal("DELETE"),
    t.Literal("PATCH"),
    t.Literal("OPTIONS"),
    t.Literal("HEAD"),
  ]),
  headers: t.Record(t.String(), t.String()),
  data: t.Optional(t.Record(t.String(), t.Unknown())),
});

const app = new Elysia()
  .use(cors()) // Add CORS support
  .post(
    "/proxy",
    async ({ body }) => {
      try {
        const { url, method, headers, data } = body;

        // Send proxy request
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: method === "GET" ? undefined : JSON.stringify(data),
        });
        response.headers.append("X-Theta-Proxied", "true");

        // Return the response directly with all original headers and body
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
      } catch (error) {
        console.error("Error occurred during proxy request:", error);

        return new Response(
          JSON.stringify({
            proxyerror:
              error instanceof Error
                ? error.message
                : "An unknown error occurred",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
    },
    {
      body: ProxyRequestSchema,
    }
  )
  .listen(3000);

console.log(
  `🦊 Elysia proxy server is running at ${app.server?.hostname}:${app.server?.port}`
);
