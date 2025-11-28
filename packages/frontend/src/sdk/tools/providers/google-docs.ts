import type { ITool, IToolProvider } from "@/sdk/shared";
import type { IConfigSchema } from "@/sdk/config-schema";
import { ToolExecutionError, ToolParameterError, ToolRegistryError } from "@/sdk/tools/errors";
import type { IGoogleDocsConfig } from "@/sdk/tools/providers/google-docs.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const DOCS_SCOPE_READONLY = "https://www.googleapis.com/auth/documents.readonly";
const DOCS_SCOPE_DOCUMENTS = "https://www.googleapis.com/auth/documents";
const DRIVE_SCOPE_METADATA_READONLY = "https://www.googleapis.com/auth/drive.metadata.readonly";

export class GoogleDocsProvider implements IToolProvider<IGoogleDocsConfig> {
  static id = "google-docs";
  id = "google-docs";
  displayName = "Google Docs";
  description = "Access and edit your Google Docs";

  private configSchema: Record<keyof IGoogleDocsConfig, IConfigSchema> = {
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
        "Google API Key (optional for Docs with OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleDocsConfig) {
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

  getDefaultConfig(): IGoogleDocsConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleDocsConfig, IConfigSchema>,
    z.ZodSchema<IGoogleDocsConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-docs",
          displayName: "List Google Docs",
          description: "List user's Google Docs via Drive API",
          schema: z.object({
            q: z.string().optional().describe("Optional name substring to filter by"),
            pageSize: z
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .describe("Max results per page (default 100)"),
            pageToken: z.string().optional().describe("Page token for pagination"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_METADATA_READONLY,
            ]);
            const url = new URL("https://www.googleapis.com/drive/v3/files");
            const filters: string[] = [
              "mimeType='application/vnd.google-apps.document'",
              "trashed=false",
            ];
            if (params.q) {
              const sanitized = params.q.replace(/'/g, "\\'");
              filters.push(`name contains '${sanitized}'`);
            }
            url.searchParams.set("q", filters.join(" and "));
            url.searchParams.set(
              "fields",
              "nextPageToken, files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))"
            );
            url.searchParams.set("orderBy", "modifiedTime desc");
            if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
            if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
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
          id: "get-doc",
          displayName: "Get Document",
          description: "Fetch a Google Doc's structure and content",
          schema: z.object({
            documentId: z.string().nonempty().describe("Document ID"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DOCS_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://docs.googleapis.com/v1/documents/${encodeURIComponent(params.documentId)}`
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
        {
          id: "create-doc",
          displayName: "Create Document",
          description: "Create a new Google Doc with an optional title",
          schema: z.object({
            title: z.string().optional().describe("Title for the new document"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DOCS_SCOPE_DOCUMENTS,
            ]);
            const url = new URL("https://docs.googleapis.com/v1/documents");
            const res = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params.title ? { title: params.title } : {}),
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
          id: "append-text",
          displayName: "Append Text",
          description: "Append text to the end of a document",
          schema: z.object({
            documentId: z.string().nonempty(),
            text: z.string().nonempty().describe("Text to append at end of doc"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DOCS_SCOPE_DOCUMENTS,
            ]);
            const url = new URL(
              `https://docs.googleapis.com/v1/documents/${encodeURIComponent(params.documentId)}:batchUpdate`
            );
            const body = {
              requests: [
                {
                  insertText: {
                    endOfSegmentLocation: {},
                    text: params.text,
                  },
                },
              ],
            };
            const res = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
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
          id: "replace-text",
          displayName: "Replace Text (All)",
          description: "Replace all occurrences of a text string in a document",
          schema: z.object({
            documentId: z.string().nonempty(),
            query: z.string().nonempty().describe("Text to find"),
            replace: z.string().default("").describe("Replacement text"),
            matchCase: z.boolean().optional().describe("Case sensitive match"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DOCS_SCOPE_DOCUMENTS,
            ]);
            const url = new URL(
              `https://docs.googleapis.com/v1/documents/${encodeURIComponent(params.documentId)}:batchUpdate`
            );
            const body = {
              requests: [
                {
                  replaceAllText: {
                    containsText: {
                      text: params.query,
                      matchCase: params.matchCase ?? false,
                    },
                    replaceText: params.replace,
                  },
                },
              ],
            };
            const res = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
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