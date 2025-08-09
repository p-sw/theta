import type { IConfigSchema, ITool, IToolProvider } from "@/sdk/shared";
import { ToolExecutionError, ToolParameterError, ToolRegistryError } from "@/sdk/tools/errors";
import type { ILinearConfig } from "@/sdk/tools/providers/linear.types";
import { proxyfetch } from "@/lib/proxy";
import z from "zod";

export class LinearProvider implements IToolProvider<ILinearConfig> {
  static id = "linear";
  id = "linear";
  displayName = "Linear";
  description = "Interact with Linear via GraphQL (list teams, create issues)";

  private config: ILinearConfig | null = null;

  private configSchema: Record<keyof ILinearConfig, IConfigSchema> = {
    apiKey: {
      type: "string",
      displayName: "API Key",
      description: "Linear personal API key (Profile → API Keys)",
    },
    apiUrl: {
      type: "string",
      displayName: "API URL",
      description: "Optional Linear GraphQL endpoint override",
      disabled: true,
    },
  };

  private configSchemaZod = z.object({
    apiKey: z.string().nonempty(),
    apiUrl: z.string().url().optional(),
  });

  setup(config: ILinearConfig) {
    try {
      this.configSchemaZod.parse(config);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ToolRegistryError(JSON.stringify(z.treeifyError(e)));
      }
      throw e;
    }
    this.config = {
      apiUrl: "https://api.linear.app/graphql",
      ...config,
    };
  }

  getDefaultConfig(): ILinearConfig {
    return {
      apiKey: "",
      apiUrl: "https://api.linear.app/graphql",
    };
  }

  getConfigSchema(): [Record<keyof ILinearConfig, IConfigSchema>, z.ZodSchema<ILinearConfig>] {
    return [this.configSchema, this.configSchemaZod];
  }

  private get headers() {
    if (!this.config) throw new ToolRegistryError("Linear provider is not configured");
    return {
      "Content-Type": "application/json",
      // Linear expects the API key in Authorization header without Bearer
      Authorization: this.config.apiKey,
    } as Record<string, string>;
  }

  private get apiUrl() {
    if (!this.config) throw new ToolRegistryError("Linear provider is not configured");
    return this.config.apiUrl ?? "https://api.linear.app/graphql";
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-teams",
          displayName: "List Teams",
          description: "Fetch teams in the workspace (id, name, key)",
          schema: z.object({}),
          execute: async () => {
            const res = await proxyfetch(this.apiUrl, {
              method: "POST",
              headers: this.headers,
              body: {
                query: `query Teams { teams(first: 50) { nodes { id name key } } }`,
              },
            });
            if (!res.ok) {
              throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
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
          id: "create-issue",
          displayName: "Create Issue",
          description: "Create a Linear issue in a team",
          schema: z.object({
            teamId: z.string().nonempty().describe("Linear team ID"),
            title: z.string().nonempty().describe("Issue title"),
            description: z.string().optional().describe("Issue description (markdown supported)"),
            priority: z
              .number()
              .int()
              .min(0)
              .max(4)
              .optional()
              .describe("Priority 0-4 (0=No priority)"),
          }),
          execute: async (params) => {
            const variables = {
              input: {
                teamId: params.teamId,
                title: params.title,
                description: params.description,
                priority: params.priority,
              },
            } as const;
            const res = await proxyfetch(this.apiUrl, {
              method: "POST",
              headers: this.headers,
              body: {
                query: `mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }`,
                variables,
              },
            });
            if (!res.ok) {
              throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
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