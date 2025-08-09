import type { IConfigSchema, ITool, IToolProvider } from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleDriveConfig } from "@/sdk/tools/providers/google-drive.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const DRIVE_SCOPE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_SCOPE_FULL = "https://www.googleapis.com/auth/drive";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export class GoogleDriveProvider implements IToolProvider<IGoogleDriveConfig> {
  static id = "google-drive";
  id = "google-drive";
  displayName = "Google Drive";
  description = "Access your Google Drive files";

  private configSchema: Record<keyof IGoogleDriveConfig, IConfigSchema> = {
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
        "Google API Key (optional for Drive with OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleDriveConfig) {
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

  getDefaultConfig(): IGoogleDriveConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleDriveConfig, IConfigSchema>,
    z.ZodSchema<IGoogleDriveConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-files",
          displayName: "List Files",
          description: "List files in Google Drive with optional query and paging",
          schema: z.object({
            q: z
              .string()
              .optional()
              .describe(
                "Search query in Drive API format, e.g., " +
                  "name contains 'report' and mimeType != 'application/vnd.google-apps.folder'"
              ),
            pageSize: z
              .number()
              .int()
              .min(1)
              .max(1000)
              .optional()
              .describe("Maximum number of files to return"),
            pageToken: z.string().optional().describe("Page token for next page"),
            orderBy: z
              .string()
              .optional()
              .describe(
                "Sort order, e.g., 'folder,modifiedTime desc' (see Drive API orderBy)"
              ),
            spaces: z
              .enum(["drive", "appDataFolder", "photos"]) // Drive API spaces
              .optional(),
            includeItemsFromAllDrives: z
              .boolean()
              .optional()
              .describe("Whether to include files from shared drives"),
            supportsAllDrives: z
              .boolean()
              .optional()
              .describe("Whether the application supports shared drives"),
            fields: z
              .string()
              .optional()
              .describe(
                "Partial response fields parameter. Example: 'nextPageToken, files(id, name, mimeType)'"
              ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_READONLY,
            ]);
            const url = new URL("https://www.googleapis.com/drive/v3/files");
            if (params.q) url.searchParams.set("q", params.q);
            if (params.pageSize)
              url.searchParams.set("pageSize", String(params.pageSize));
            if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
            if (params.orderBy) url.searchParams.set("orderBy", params.orderBy);
            if (params.spaces) url.searchParams.set("spaces", params.spaces);
            if (params.includeItemsFromAllDrives !== undefined)
              url.searchParams.set(
                "includeItemsFromAllDrives",
                String(params.includeItemsFromAllDrives)
              );
            if (params.supportsAllDrives !== undefined)
              url.searchParams.set(
                "supportsAllDrives",
                String(params.supportsAllDrives)
              );
            if (params.fields) url.searchParams.set("fields", params.fields);

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
          id: "get-file-metadata",
          displayName: "Get File Metadata",
          description: "Fetch metadata for a specific file",
          schema: z.object({
            fileId: z.string().nonempty(),
            fields: z
              .string()
              .optional()
              .describe(
                "Partial response fields. Example: 'id, name, mimeType, size, modifiedTime'"
              ),
            acknowledgeAbuse: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}`
            );
            if (params.fields) url.searchParams.set("fields", params.fields);
            if (params.acknowledgeAbuse !== undefined)
              url.searchParams.set(
                "acknowledgeAbuse",
                String(params.acknowledgeAbuse)
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
          id: "download-file",
          displayName: "Download File (base64)",
          description:
            "Download file content as base64 string. Returns a JSON with base64 and mimeType.",
          schema: z.object({
            fileId: z.string().nonempty(),
            acknowledgeAbuse: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}`
            );
            url.searchParams.set("alt", "media");
            if (params.acknowledgeAbuse !== undefined)
              url.searchParams.set(
                "acknowledgeAbuse",
                String(params.acknowledgeAbuse)
              );

            const res = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
            const buf = await res.arrayBuffer();
            const base64 = arrayBufferToBase64(buf);
            return JSON.stringify({ fileId: params.fileId, mimeType, base64 });
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
          id: "export-file",
          displayName: "Export Google Doc/Sheet/Slide",
          description:
            "Export a Google Docs/Sheets/Slides file to a specific MIME type. Returns JSON with base64 and mimeType.",
          schema: z.object({
            fileId: z.string().nonempty(),
            mimeType: z.string().nonempty().describe("Target export MIME type"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}/export`
            );
            url.searchParams.set("mimeType", params.mimeType);

            const res = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            const mimeType = res.headers.get("content-type") ?? params.mimeType;
            const buf = await res.arrayBuffer();
            const base64 = arrayBufferToBase64(buf);
            return JSON.stringify({ fileId: params.fileId, mimeType, base64 });
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
          id: "update-file-metadata",
          displayName: "Update File Metadata",
          description:
            "Update file metadata like name or description. Optionally move by add/remove parents.",
          schema: z.object({
            fileId: z.string().nonempty(),
            name: z.string().optional(),
            description: z.string().optional(),
            starred: z.boolean().optional(),
            addParents: z.array(z.string()).optional(),
            removeParents: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_FULL,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}`
            );
            if (params.addParents && params.addParents.length > 0)
              url.searchParams.set("addParents", params.addParents.join(","));
            if (params.removeParents && params.removeParents.length > 0)
              url.searchParams.set(
                "removeParents",
                params.removeParents.join(",")
              );

            const body: Record<string, unknown> = {};
            if (params.name !== undefined) body.name = params.name;
            if (params.description !== undefined)
              body.description = params.description;
            if (params.starred !== undefined) body.starred = params.starred;

            const res = await fetch(url.toString(), {
              method: "PATCH",
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
          id: "delete-file",
          displayName: "Delete File",
          description: "Delete a file by ID",
          schema: z.object({
            fileId: z.string().nonempty(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_FULL,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}`
            );
            const res = await fetch(url.toString(), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            return "";
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
          id: "list-revisions",
          displayName: "List Revisions",
          description: "List revisions of a file",
          schema: z.object({
            fileId: z.string().nonempty(),
            pageSize: z.number().int().min(1).max(200).optional(),
            pageToken: z.string().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}/revisions`
            );
            if (params.pageSize)
              url.searchParams.set("pageSize", String(params.pageSize));
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
          id: "create-permission",
          displayName: "Share / Create Permission",
          description:
            "Create a permission on a file (e.g., share with a user, domain, or anyone)",
          schema: z.object({
            fileId: z.string().nonempty(),
            role: z
              .enum(["owner", "organizer", "fileOrganizer", "writer", "commenter", "reader"])
              .describe("Access role for the grantee"),
            type: z
              .enum(["user", "group", "domain", "anyone"])
              .describe("The type of grantee"),
            emailAddress: z
              .string()
              .email()
              .optional()
              .describe("Required if type is 'user' or 'group'"),
            domain: z.string().optional().describe("Required if type is 'domain'"),
            allowFileDiscovery: z
              .boolean()
              .optional()
              .describe(
                "For 'anyone'/'domain' permissions, whether the link is discoverable"
              ),
            sendNotificationEmail: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              DRIVE_SCOPE_FULL,
            ]);
            const url = new URL(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
                params.fileId
              )}/permissions`
            );
            if (params.sendNotificationEmail !== undefined)
              url.searchParams.set(
                "sendNotificationEmail",
                String(params.sendNotificationEmail)
              );

            const body: Record<string, unknown> = {
              role: params.role,
              type: params.type,
            };
            if (params.emailAddress) body.emailAddress = params.emailAddress;
            if (params.domain) body.domain = params.domain;
            if (params.allowFileDiscovery !== undefined)
              body.allowFileDiscovery = params.allowFileDiscovery;

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