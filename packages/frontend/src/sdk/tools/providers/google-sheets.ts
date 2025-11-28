import type { ITool, IToolProvider } from "@/sdk/shared";
import type { IConfigSchema } from "@/sdk/config-schema";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleSheetsConfig } from "@/sdk/tools/providers/google-sheets.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const SHEETS_SCOPE_READONLY = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export class GoogleSheetsProvider
  implements IToolProvider<IGoogleSheetsConfig>
{
  static id = "google-sheets";
  id = "google-sheets";
  displayName = "Google Sheets";
  description = "Access and modify data in Google Sheets";

  private configSchema: Record<keyof IGoogleSheetsConfig, IConfigSchema> = {
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
        "Google API Key (optional for OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleSheetsConfig) {
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

  getDefaultConfig(): IGoogleSheetsConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleSheetsConfig, IConfigSchema>,
    z.ZodSchema<IGoogleSheetsConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      const rangeSchema = z.string().nonempty().describe("A1 notation range e.g. Sheet1!A1:C10");

      this._tools = [
        {
          id: "get-values",
          displayName: "Get Values",
          description: "Read a range of values from a spreadsheet",
          schema: z.object({
            spreadsheetId: z
              .string()
              .nonempty()
              .describe("Spreadsheet ID from the URL"),
            range: rangeSchema,
            valueRenderOption: z
              .enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
              .optional(),
            dateTimeRenderOption: z
              .enum(["SERIAL_NUMBER", "FORMATTED_STRING"])
              .optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              SHEETS_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
                params.spreadsheetId
              )}/values/${encodeURIComponent(params.range)}`
            );
            if (params.valueRenderOption)
              url.searchParams.set("valueRenderOption", params.valueRenderOption);
            if (params.dateTimeRenderOption)
              url.searchParams.set(
                "dateTimeRenderOption",
                params.dateTimeRenderOption
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
          id: "append-values",
          displayName: "Append Values",
          description: "Append rows to a range in a spreadsheet",
          schema: z.object({
            spreadsheetId: z.string().nonempty(),
            range: rangeSchema.describe(
              "Target range in A1 notation where to append, e.g. Sheet1!A1"
            ),
            values: z
              .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
              .nonempty()
              .describe("2D array of values to append"),
            valueInputOption: z
              .enum(["RAW", "USER_ENTERED"])
              .default("USER_ENTERED"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([SHEETS_SCOPE]);
            const url = new URL(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
                params.spreadsheetId
              )}/values/${encodeURIComponent(params.range)}:append`
            );
            url.searchParams.set("valueInputOption", params.valueInputOption);
            const body = { values: params.values };
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
          id: "update-values",
          displayName: "Update Values",
          description: "Update a range of cells with provided values",
          schema: z.object({
            spreadsheetId: z.string().nonempty(),
            range: rangeSchema,
            values: z
              .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
              .nonempty(),
            valueInputOption: z
              .enum(["RAW", "USER_ENTERED"])
              .default("USER_ENTERED"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([SHEETS_SCOPE]);
            const url = new URL(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
                params.spreadsheetId
              )}/values/${encodeURIComponent(params.range)}`
            );
            url.searchParams.set("valueInputOption", params.valueInputOption);
            const body = { values: params.values, majorDimension: "ROWS" };
            const res = await fetch(url.toString(), {
              method: "PUT",
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
          id: "clear-values",
          displayName: "Clear Values",
          description: "Clear the values in a specified range",
          schema: z.object({
            spreadsheetId: z.string().nonempty(),
            range: rangeSchema,
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([SHEETS_SCOPE]);
            const url = new URL(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
                params.spreadsheetId
              )}/values/${encodeURIComponent(params.range)}:clear`
            );
            const res = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
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
          id: "get-spreadsheet",
          displayName: "Get Spreadsheet",
          description: "Retrieve spreadsheet metadata and sheets",
          schema: z.object({
            spreadsheetId: z.string().nonempty(),
            includeGridData: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              SHEETS_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
                params.spreadsheetId
              )}`
            );
            if (params.includeGridData !== undefined) {
              url.searchParams.set(
                "includeGridData",
                String(params.includeGridData)
              );
            }
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
          id: "create-spreadsheet",
          displayName: "Create Spreadsheet",
          description: "Create a new spreadsheet with optional title",
          schema: z.object({
            title: z.string().optional().describe("Spreadsheet title"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([SHEETS_SCOPE]);
            const body: Record<string, unknown> = {};
            if (params.title) {
              body.properties = { title: params.title };
            }
            const res = await fetch(
              "https://sheets.googleapis.com/v4/spreadsheets",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
              }
            );
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