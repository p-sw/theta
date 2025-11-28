import type { ITool, IToolProvider } from "@/sdk/shared";
import type { IConfigSchema } from "@/sdk/config-schema";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleTasksConfig } from "@/sdk/tools/providers/google-tasks.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const TASKS_SCOPE_READONLY =
  "https://www.googleapis.com/auth/tasks.readonly";
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

export class GoogleTasksProvider
  implements IToolProvider<IGoogleTasksConfig>
{
  static id = "google-tasks";
  id = "google-tasks";
  displayName = "Google Tasks";
  description = "Access your Google Tasks";

  private configSchema: Record<keyof IGoogleTasksConfig, IConfigSchema> = {
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
        "Google API Key (optional for Tasks with OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleTasksConfig) {
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

  getDefaultConfig(): IGoogleTasksConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleTasksConfig, IConfigSchema>,
    z.ZodSchema<IGoogleTasksConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "list-tasklists",
          displayName: "List Task Lists",
          description: "List the user's task lists",
          schema: z.object({
            maxResults: z
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .describe("Maximum number of task lists to return (1-100)"),
            pageToken: z
              .string()
              .optional()
              .describe("Token specifying which result page to return"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              TASKS_SCOPE_READONLY,
            ]);
            const url = new URL(
              "https://www.googleapis.com/tasks/v1/users/@me/lists"
            );
            if (params.maxResults)
              url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
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
          id: "list-tasks",
          displayName: "List Tasks",
          description:
            "List tasks within a task list with optional filters and pagination",
          schema: z.object({
            tasklist: z
              .string()
              .nonempty()
              .describe("Task list ID (e.g., '@default' or from list-tasklists)"),
            maxResults: z
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .describe("Maximum number of tasks to return (1-100)"),
            pageToken: z.string().optional(),
            q: z.string().optional().describe("Full-text search query"),
            completedMin: z
              .string()
              .optional()
              .describe("Lower bound for a task's completion date (RFC3339)"),
            completedMax: z
              .string()
              .optional()
              .describe("Upper bound for a task's completion date (RFC3339)"),
            dueMin: z
              .string()
              .optional()
              .describe("Lower bound for a task's due date (RFC3339)"),
            dueMax: z
              .string()
              .optional()
              .describe("Upper bound for a task's due date (RFC3339)"),
            updatedMin: z
              .string()
              .optional()
              .describe("Lower bound for a task's last modification time (RFC3339)"),
            showCompleted: z.boolean().optional(),
            showDeleted: z.boolean().optional(),
            showHidden: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              TASKS_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/tasks`
            );
            if (params.maxResults)
              url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.q) url.searchParams.set("q", params.q);
            if (params.completedMin)
              url.searchParams.set("completedMin", params.completedMin);
            if (params.completedMax)
              url.searchParams.set("completedMax", params.completedMax);
            if (params.dueMin) url.searchParams.set("dueMin", params.dueMin);
            if (params.dueMax) url.searchParams.set("dueMax", params.dueMax);
            if (params.updatedMin)
              url.searchParams.set("updatedMin", params.updatedMin);
            if (params.showCompleted !== undefined)
              url.searchParams.set("showCompleted", String(params.showCompleted));
            if (params.showDeleted !== undefined)
              url.searchParams.set("showDeleted", String(params.showDeleted));
            if (params.showHidden !== undefined)
              url.searchParams.set("showHidden", String(params.showHidden));
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
          id: "insert-task",
          displayName: "Create Task",
          description: "Create a new task in a task list",
          schema: z.object({
            tasklist: z.string().nonempty(),
            title: z.string().nonempty().describe("Task title"),
            notes: z.string().optional(),
            due: z
              .string()
              .optional()
              .describe("Due date/time in RFC3339, e.g., 2025-08-12T09:00:00-07:00"),
            status: z
              .enum(["needsAction", "completed"]) // per Tasks API
              .optional(),
            parent: z
              .string()
              .optional()
              .describe("Parent task ID to create a subtask under"),
            previous: z
              .string()
              .optional()
              .describe("Previous sibling task ID to position after"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([TASKS_SCOPE]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/tasks`
            );
            if (params.parent) url.searchParams.set("parent", params.parent);
            if (params.previous)
              url.searchParams.set("previous", params.previous);
            const body: Record<string, unknown> = {
              title: params.title,
            };
            if (params.notes !== undefined) body.notes = params.notes;
            if (params.due !== undefined) body.due = params.due;
            if (params.status !== undefined) body.status = params.status;
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
          id: "update-task",
          displayName: "Update Task",
          description: "Update fields of an existing task (PATCH)",
          schema: z.object({
            tasklist: z.string().nonempty(),
            taskId: z.string().nonempty(),
            title: z.string().optional(),
            notes: z.string().optional(),
            due: z
              .string()
              .optional()
              .describe("Due date/time in RFC3339"),
            status: z.enum(["needsAction", "completed"]).optional(),
            completed: z
              .string()
              .optional()
              .describe("Completion timestamp in RFC3339 if marking completed"),
            deleted: z.boolean().optional(),
            hidden: z.boolean().optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([TASKS_SCOPE]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/tasks/${encodeURIComponent(params.taskId)}`
            );
            const body: Record<string, unknown> = {};
            if (params.title !== undefined) body.title = params.title;
            if (params.notes !== undefined) body.notes = params.notes;
            if (params.due !== undefined) body.due = params.due;
            if (params.status !== undefined) body.status = params.status;
            if (params.completed !== undefined)
              body.completed = params.completed;
            if (params.deleted !== undefined) body.deleted = params.deleted;
            if (params.hidden !== undefined) body.hidden = params.hidden;
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
          id: "delete-task",
          displayName: "Delete Task",
          description: "Delete a task by ID",
          schema: z.object({
            tasklist: z.string().nonempty(),
            taskId: z.string().nonempty(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([TASKS_SCOPE]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/tasks/${encodeURIComponent(params.taskId)}`
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
          id: "move-task",
          displayName: "Move Task",
          description:
            "Move a task to a new parent or position within the same list",
          schema: z
            .object({
              tasklist: z.string().nonempty(),
              taskId: z.string().nonempty(),
              parent: z
                .string()
                .optional()
                .describe("New parent task ID to move under (for subtasks)"),
              previous: z
                .string()
                .optional()
                .describe("Previous sibling task ID to position after"),
            })
            .refine((v) => Boolean(v.parent || v.previous), {
              message: "Provide at least one of parent or previous",
            }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([TASKS_SCOPE]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/tasks/${encodeURIComponent(params.taskId)}/move`
            );
            if (params.parent) url.searchParams.set("parent", params.parent);
            if (params.previous)
              url.searchParams.set("previous", params.previous);
            const res = await fetch(url.toString(), {
              method: "POST",
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
          id: "clear-completed",
          displayName: "Clear Completed Tasks",
          description: "Clear all completed tasks from a task list",
          schema: z.object({
            tasklist: z.string().nonempty(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([TASKS_SCOPE]);
            const url = new URL(
              `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(
                params.tasklist
              )}/clear`
            );
            const res = await fetch(url.toString(), {
              method: "POST",
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