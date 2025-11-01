import {
  type IConfigSchema,
  type ITool,
  type IToolProvider,
} from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import z from "zod";

const CONFIG_SCHEMA_ZOD = z.object({});
type JavaScriptApiConfig = z.infer<typeof CONFIG_SCHEMA_ZOD>;

const FETCH_METHOD_SCHEMA = z.enum([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const geolocationSchema = z
  .object({
    enableHighAccuracy: z
      .boolean()
      .default(false)
      .describe(
        "Request the most accurate location possible. May increase response time and power consumption."
      ),
    timeoutMs: z
      .number()
      .int()
      .min(0)
      .max(600000)
      .optional()
      .describe(
        "Timeout (in milliseconds) before the request automatically fails. Defaults to unlimited."
      ),
    maximumAgeMs: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Accept a cached position whose age is no greater than the specified time in milliseconds."
      ),
  })
  .describe("Retrieve the user's current geographic position using the Geolocation API.");

const fetchSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe(
        "Absolute URL to fetch. Must include the protocol (http or https)."
      ),
    method: FETCH_METHOD_SCHEMA.default("GET").describe("HTTP method to use."),
    headers: z
      .record(z.string())
      .default({})
      .describe("Optional HTTP headers to include in the request."),
    body: z
      .string()
      .optional()
      .describe(
        "Request body as a string. Only used for methods that support a body (e.g. POST, PUT, PATCH)."
      ),
  })
  .superRefine((data, ctx) => {
    if ((data.method === "GET" || data.method === "HEAD") && data.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request body is not allowed for GET or HEAD requests.",
        path: ["body"],
      });
    }
  })
  .describe(
    "Perform a network request using the Fetch API. Returns status, headers, and body (truncated to 10k characters)."
  );

export class JavaScriptApiProvider
  implements IToolProvider<JavaScriptApiConfig>
{
  static id = "javascript-api";
  id = JavaScriptApiProvider.id;
  displayName = "Browser JavaScript APIs";
  description =
    "Use built-in browser JavaScript APIs like Geolocation and Fetch.";

  private readonly configSchema: Record<
    keyof JavaScriptApiConfig,
    IConfigSchema
  > = {} as Record<keyof JavaScriptApiConfig, IConfigSchema>;

  private readonly configSchemaZod = CONFIG_SCHEMA_ZOD;

  private config: JavaScriptApiConfig = {};

  private readonly toolsList: ITool[] = [
    {
      id: "geolocation-current-position",
      displayName: "Get Current Position",
      description:
        "Get the user's current geographic location using the browser Geolocation API.",
      schema: geolocationSchema,
      execute: async (parameters) => {
        const args = await geolocationSchema.parseAsync(parameters);

        if (typeof navigator === "undefined" || !navigator.geolocation) {
          throw new ToolExecutionError(
            "Geolocation API is not available in this environment."
          );
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
              reject(
                new ToolExecutionError(
                  `${error.code}: ${error.message}`
                )
              );
            },
            {
              enableHighAccuracy: args.enableHighAccuracy,
              timeout: args.timeoutMs,
              maximumAge: args.maximumAgeMs,
            }
          );
        });

        const {
          coords: {
            accuracy,
            altitude,
            altitudeAccuracy,
            heading,
            latitude,
            longitude,
            speed,
          },
          timestamp,
        } = position;

        return JSON.stringify({
          timestamp,
          coords: {
            latitude,
            longitude,
            accuracy,
            altitude,
            altitudeAccuracy,
            heading,
            speed,
          },
        });
      },
      async ensureParameters(parameters) {
        try {
          await geolocationSchema.parseAsync(parameters);
        } catch (e) {
          if (e instanceof z.ZodError) {
            throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
          }
          throw new ToolParameterError((e as Error).message);
        }
      },
    },
    {
      id: "fetch-request",
      displayName: "Fetch Request",
      description:
        "Make an HTTP request using the browser fetch() API and return the response details.",
      schema: fetchSchema,
      execute: async (parameters) => {
        const args = await fetchSchema.parseAsync(parameters);

        if (typeof fetch === "undefined") {
          throw new ToolExecutionError("Fetch API is not available in this environment.");
        }

        const { url, method, headers, body } = args;
        const fetchInit: RequestInit = {
          method,
          headers: Object.keys(headers ?? {}).length > 0 ? headers : undefined,
        };

        if (body && method !== "GET" && method !== "HEAD") {
          fetchInit.body = body;
        }

        const startedAt = Date.now();

        let response: Response;
        try {
          response = await fetch(url, fetchInit);
        } catch (error) {
          throw new ToolExecutionError(`Fetch failed: ${(error as Error).message}`);
        }

        const durationMs = Date.now() - startedAt;
        const headersObject = Object.fromEntries(response.headers.entries());

        let bodyText: string;
        try {
          bodyText = await response.text();
        } catch (error) {
          throw new ToolExecutionError(
            `Failed to read response body: ${(error as Error).message}`
          );
        }

        const maxLength = 10_000;
        const truncated = bodyText.length > maxLength;
        const truncatedBody = truncated
          ? `${bodyText.slice(0, maxLength)}\n...[truncated ${bodyText.length - maxLength} characters]`
          : bodyText;

        let parsedJson: unknown = null;
        const contentType = response.headers.get("content-type") ?? "";
        if (!truncated && contentType.includes("application/json")) {
          try {
            parsedJson = JSON.parse(bodyText);
          } catch {
            parsedJson = null;
          }
        }

        return JSON.stringify({
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          durationMs,
          headers: headersObject,
          bodyText: truncatedBody,
          truncated,
          contentType,
          bodyJson: parsedJson,
        });
      },
      async ensureParameters(parameters) {
        try {
          await fetchSchema.parseAsync(parameters);
        } catch (e) {
          if (e instanceof z.ZodError) {
            throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
          }
          throw new ToolParameterError((e as Error).message);
        }
      },
    },
  ];

  setup(config: JavaScriptApiConfig) {
    try {
      this.config = this.configSchemaZod.parse(config);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ToolRegistryError(JSON.stringify(z.treeifyError(e)));
      }
      throw e;
    }
  }

  getDefaultConfig(): JavaScriptApiConfig {
    return {};
  }

  getConfigSchema(): [
    Record<keyof JavaScriptApiConfig, IConfigSchema>,
    z.ZodSchema<JavaScriptApiConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  get tools(): ITool[] {
    return this.toolsList;
  }

  async execute(toolId: string, parameters: unknown): Promise<string> {
    const tool = this.tools.find((item) => item.id === toolId);
    if (!tool) {
      throw new ToolRegistryError(`Tool ${toolId} not found`);
    }
    await tool.ensureParameters(parameters);
    return await tool.execute(parameters);
  }
}

