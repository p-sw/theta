import type { ITool, IToolProvider } from "@/sdk/shared";
import type { IConfigSchema } from "@/sdk/config-schema";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleContactsConfig } from "@/sdk/tools/providers/google-contacts.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const CONTACTS_SCOPE_READONLY =
  "https://www.googleapis.com/auth/contacts.readonly";
const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";

const PERSON_FIELDS = [
  "addresses",
  "ageRanges",
  "biographies",
  "birthdays",
  "braggingRights",
  "calendarUrls",
  "clientData",
  "coverPhotos",
  "emailAddresses",
  "events",
  "externalIds",
  "genders",
  "imClients",
  "interests",
  "locales",
  "locations",
  "memberships",
  "metadata",
  "miscKeywords",
  "names",
  "nicknames",
  "occupations",
  "organizations",
  "phoneNumbers",
  "photos",
  "relations",
  "residences",
  "sipAddresses",
  "skills",
  "urls",
  "userDefined",
] as const;

const personFieldsArraySchema = z
  .array(z.enum(PERSON_FIELDS))
  .min(1)
  .describe(
    "Person fields to include. Choose only what you actually need to reduce payload size."
  );

export class GoogleContactsProvider
  implements IToolProvider<IGoogleContactsConfig>
{
  static id = "google-contacts";
  id = "google-contacts";
  displayName = "Google Contacts";
  description = "Access your Google Contacts via People API";

  private configSchema: Record<keyof IGoogleContactsConfig, IConfigSchema> = {
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
        "Google API Key (optional with OAuth, but useful for certain Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleContactsConfig) {
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

  getDefaultConfig(): IGoogleContactsConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleContactsConfig, IConfigSchema>,
    z.ZodSchema<IGoogleContactsConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-connections",
          displayName: "List Connections",
          description:
            "List contacts from the user's connections (people/me/connections)",
          schema: z.object({
            pageSize: z
              .number()
              .int()
              .min(1)
              .max(2000)
              .optional()
              .describe("Max number of results to return (default 100, max 2000)"),
            pageToken: z.string().optional(),
            sortOrder: z
              .enum(["FIRST_NAME_ASCENDING", "LAST_NAME_ASCENDING"]) // per API docs
              .optional(),
            personFields: personFieldsArraySchema.describe(
              "Fields to include in the response"
            ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE_READONLY,
            ]);
            const url = new URL(
              "https://people.googleapis.com/v1/people/me/connections"
            );
            url.searchParams.set(
              "personFields",
              (params.personFields as string[]).join(",")
            );
            if (params.pageSize)
              url.searchParams.set("pageSize", String(params.pageSize));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.sortOrder)
              url.searchParams.set("sortOrder", params.sortOrder);
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
          id: "search-contacts",
          displayName: "Search Contacts",
          description: "Search contacts by query string",
          schema: z.object({
            query: z.string().nonempty().describe("Free-text search query"),
            pageSize: z.number().int().min(1).max(2000).optional(),
            pageToken: z.string().optional(),
            personFields: personFieldsArraySchema.describe(
              "Fields to include in the response"
            ),
            readDeletedContacts: z
              .boolean()
              .optional()
              .describe("Whether to include deleted contacts in results"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE_READONLY,
            ]);
            const url = new URL(
              "https://people.googleapis.com/v1/people:searchContacts"
            );
            url.searchParams.set("query", params.query);
            // For searchContacts, the field mask param is named readMask
            url.searchParams.set(
              "readMask",
              (params.personFields as string[]).join(",")
            );
            if (params.pageSize)
              url.searchParams.set("pageSize", String(params.pageSize));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.readDeletedContacts !== undefined)
              url.searchParams.set(
                "readDeletedContacts",
                String(params.readDeletedContacts)
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
          id: "get-person",
          displayName: "Get Person",
          description:
            "Get a single person by resource name (e.g., people/c12345)",
          schema: z.object({
            resourceName: z
              .string()
              .nonempty()
              .describe("Resource name like 'people/XXXXX' or just the ID"),
            personFields: personFieldsArraySchema.describe(
              "Fields to include in the response"
            ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE_READONLY,
            ]);
            const resourceName = (params.resourceName as string).startsWith(
              "people/"
            )
              ? (params.resourceName as string)
              : `people/${params.resourceName}`;
            const url = new URL(
              `https://people.googleapis.com/v1/${encodeURIComponent(
                resourceName
              )}`
            );
            url.searchParams.set(
              "personFields",
              (params.personFields as string[]).join(",")
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
          id: "create-contact",
          displayName: "Create Contact",
          description: "Create a new contact",
          schema: z.object({
            person: z
              .any()
              .describe(
                "Person object per People API (e.g., names, emailAddresses, phoneNumbers, organizations)"
              ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE,
            ]);
            const url = new URL(
              "https://people.googleapis.com/v1/people:createContact"
            );
            const res = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params.person ?? {}),
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
          id: "update-contact",
          displayName: "Update Contact",
          description: "Update fields of an existing contact (PATCH)",
          schema: z.object({
            resourceName: z
              .string()
              .nonempty()
              .describe("Resource name like 'people/XXXXX' or just the ID"),
            person: z
              .any()
              .describe(
                "Partial Person object with fields to update per People API"
              ),
            updatePersonFields: personFieldsArraySchema.describe(
              "Fields being updated; must correspond to keys present in person"
            ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE,
            ]);
            const resourceName = (params.resourceName as string).startsWith(
              "people/"
            )
              ? (params.resourceName as string)
              : `people/${params.resourceName}`;
            const url = new URL(
              `https://people.googleapis.com/v1/${encodeURIComponent(
                resourceName
              )}:updateContact`
            );
            url.searchParams.set(
              "updatePersonFields",
              (params.updatePersonFields as string[]).join(",")
            );
            const res = await fetch(url.toString(), {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params.person ?? {}),
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
          id: "delete-contact",
          displayName: "Delete Contact",
          description: "Delete a contact by resource name",
          schema: z.object({
            resourceName: z
              .string()
              .nonempty()
              .describe("Resource name like 'people/XXXXX' or just the ID"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CONTACTS_SCOPE,
            ]);
            const resourceName = (params.resourceName as string).startsWith(
              "people/"
            )
              ? (params.resourceName as string)
              : `people/${params.resourceName}`;
            const url = new URL(
              `https://people.googleapis.com/v1/${encodeURIComponent(
                resourceName
              )}:deleteContact`
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