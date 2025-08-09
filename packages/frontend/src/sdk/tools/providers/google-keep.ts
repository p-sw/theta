import type { IConfigSchema, ITool, IToolProvider } from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import z from "zod";
import type { IGoogleKeepConfig } from "@/sdk/tools/providers/google-keep.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";

const KEEP_SCOPE_READONLY = "https://www.googleapis.com/auth/keep.readonly";

export class GoogleKeepProvider implements IToolProvider<IGoogleKeepConfig> {
  static id = "google-keep";
  id = "google-keep";
  displayName = "Google Keep";
  description = "Access your Google Keep notes";

  private configSchema: Record<keyof IGoogleKeepConfig, IConfigSchema> = {
    clientId: {
      type: "string",
      displayName: "OAuth Client ID",
      description:
        "Google OAuth 2.0 Client ID (Web application) for Google Identity Services",
    },
    apiKey: {
      type: "string",
      displayName: "API Key",
      description:
        "Google API Key (optional for OAuth, but used for some Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleKeepConfig) {
    try {
      this.configSchemaZod.parse(config);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ToolRegistryError(JSON.stringify(z.treeifyError(e)));
      }
      throw e;
    }
    googleAuth.setup({ clientId: config.clientId, apiKey: config.apiKey });
  }

  getDefaultConfig(): IGoogleKeepConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleKeepConfig, IConfigSchema>,
    z.ZodSchema<IGoogleKeepConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-notes",
          displayName: "List Notes",
          description:
            "List notes from Google Keep. Optionally control page size and pagination.",
          schema: z.object({
            pageSize: z
              .number()
              .int()
              .min(1)
              .max(200)
              .optional()
              .describe("Max number of notes to return (1-200)"),
            pageToken: z.string().optional().describe("Pagination token"),
            filter: z
              .string()
              .optional()
              .describe(
                "Optional server-side filter string. Example: 'trashed=false'"
              ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              KEEP_SCOPE_READONLY,
            ]);
            const url = new URL("https://keep.googleapis.com/v1/notes");
            if (params.pageSize)
              url.searchParams.set("pageSize", String(params.pageSize));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.filter) url.searchParams.set("filter", params.filter);
            const res = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "get-note",
          displayName: "Get Note",
          description: "Get a single note by its ID",
          schema: z.object({
            noteId: z
              .string()
              .nonempty()
              .describe("The note ID (not including 'notes/')."),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              KEEP_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://keep.googleapis.com/v1/notes/${encodeURIComponent(
                params.noteId
              )}`
            );
            const res = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
      ];
    }
    return this._tools;
  }

  async execute(toolId: string, parameters: unknown): Promise<string> {
    const tool = this.tools.find((t) => t.id === toolId);
    if (!tool) throw new ToolRegistryError(`Tool ${toolId} not found`);
    await tool.ensureParameters(parameters);
    return await (tool.execute as (p: unknown) => Promise<string>)(parameters);
  }
}