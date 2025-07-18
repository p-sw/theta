import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";

// Schema definition for proxy requests
const ProxyRequestSchema = t.Object({
  url: t.String(),
  headers: t.Record(t.String(), t.String()),
  data: t.Record(t.String(), t.Unknown()),
});

const app = new Elysia()
  .use(cors()) // Add CORS support
  .post(
    "/proxy",
    async ({ body }) => {
      try {
        const { url, headers, data } = body;

        // Send proxy request
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(data),
        });

        // Process response data
        const responseData = await response.text();
        let parsedData;

        try {
          parsedData = JSON.parse(responseData);
        } catch {
          parsedData = responseData;
        }

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsedData,
        };
      } catch (error) {
        console.error("Error occurred during proxy request:", error);

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
          status: 500,
        };
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
