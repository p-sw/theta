import type { IConfigSchema, ITool, IToolProvider } from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleCalendarConfig } from "@/sdk/tools/providers/google-calendar.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const CALENDAR_SCOPE_READONLY =
  "https://www.googleapis.com/auth/calendar.readonly";
const CALENDAR_SCOPE_EVENTS = "https://www.googleapis.com/auth/calendar.events";

export class GoogleCalendarProvider
  implements IToolProvider<IGoogleCalendarConfig>
{
  static id = "google-calendar";
  id = "google-calendar";
  displayName = "Google Calendar";
  description = "Access your Google Calendar data";

  private configSchema: Record<keyof IGoogleCalendarConfig, IConfigSchema> = {
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
        "Google API Key (optional for Calendar with OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleCalendarConfig) {
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

  getDefaultConfig(): IGoogleCalendarConfig {
    return {
      clientId: "",
      apiKey: "",
    };
  }

  getConfigSchema(): [
    Record<keyof IGoogleCalendarConfig, IConfigSchema>,
    z.ZodSchema<IGoogleCalendarConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      const eventDateSchema = z
        .object({
          date: z
            .string()
            .optional()
            .describe("All-day event date in YYYY-MM-DD"),
          dateTime: z
            .string()
            .optional()
            .describe("RFC3339 timestamp e.g. 2025-08-12T09:00:00-07:00"),
          timeZone: z
            .string()
            .optional()
            .describe("IANA time zone, e.g. America/Los_Angeles"),
        })
        .refine((v) => Boolean(v.date || v.dateTime), {
          message: "Either date or dateTime must be provided",
        });

      this._tools = [
        {
          id: "list-calendars",
          displayName: "List Calendars",
          description: "List calendars from the user's calendar list",
          schema: z.object({
            maxResults: z
              .number()
              .int()
              .min(1)
              .max(250)
              .optional()
              .describe(
                "Maximum number of entries returned on one result page"
              ),
            pageToken: z
              .string()
              .optional()
              .describe("Token specifying which result page to return"),
            minAccessRole: z
              .enum(["freeBusyReader", "reader", "writer", "owner"])
              .optional()
              .describe(
                "The minimum access role for the user in the returned entries"
              ),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_READONLY,
            ]);
            const url = new URL(
              "https://www.googleapis.com/calendar/v3/users/me/calendarList"
            );
            if (params.maxResults)
              url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.minAccessRole)
              url.searchParams.set("minAccessRole", params.minAccessRole);
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
          id: "list-events",
          displayName: "List Events",
          description:
            "List events for a specific calendar within an optional time range",
          schema: z.object({
            calendarId: z
              .string()
              .nonempty()
              .describe(
                "Calendar identifier, e.g., 'primary' or a calendar ID"
              ),
            timeMin: z
              .string()
              .optional()
              .describe(
                "Lower bound for an event's end time (RFC3339 timestamp)"
              ),
            timeMax: z
              .string()
              .optional()
              .describe(
                "Upper bound for an event's start time (RFC3339 timestamp)"
              ),
            q: z
              .string()
              .optional()
              .describe("Free text search terms to filter the results"),
            maxResults: z
              .number()
              .int()
              .min(1)
              .max(2500)
              .optional()
              .describe("Maximum number of events returned on one result page"),
            pageToken: z
              .string()
              .optional()
              .describe("Token specifying which result page to return"),
            singleEvents: z
              .boolean()
              .optional()
              .describe("Whether to expand recurring events into instances"),
            orderBy: z
              .enum(["startTime", "updated"])
              .optional()
              .describe("Order of the events returned"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_READONLY,
            ]);
            const url = new URL(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                params.calendarId
              )}/events`
            );
            if (params.timeMin) url.searchParams.set("timeMin", params.timeMin);
            if (params.timeMax) url.searchParams.set("timeMax", params.timeMax);
            if (params.q) url.searchParams.set("q", params.q);
            if (params.maxResults)
              url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken)
              url.searchParams.set("pageToken", params.pageToken);
            if (params.singleEvents !== undefined)
              url.searchParams.set("singleEvents", String(params.singleEvents));
            if (params.orderBy) url.searchParams.set("orderBy", params.orderBy);
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
          id: "create-event",
          displayName: "Create Event",
          description: "Create a new event on a calendar",
          schema: z.object({
            calendarId: z
              .string()
              .nonempty()
              .describe("Target calendar ID, e.g., 'primary'"),
            summary: z.string().nonempty().describe("Event title"),
            description: z.string().optional(),
            location: z.string().optional(),
            start: eventDateSchema.describe("Event start"),
            end: eventDateSchema.describe("Event end"),
            attendees: z
              .array(
                z.object({
                  email: z.string().email(),
                  optional: z.boolean().optional(),
                })
              )
              .optional(),
            recurrence: z.array(z.string()).optional().describe("RRULEs"),
            reminders: z
              .object({
                useDefault: z.boolean().optional(),
                overrides: z
                  .array(
                    z.object({
                      method: z.enum(["email", "popup"]),
                      minutes: z.number().int().min(0),
                    })
                  )
                  .optional(),
              })
              .optional(),
            sendUpdates: z
              .enum(["all", "externalOnly", "none"])
              .optional()
              .describe("Whether to send notifications to attendees"),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_EVENTS,
            ]);
            const url = new URL(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                params.calendarId
              )}/events`
            );
            if (params.sendUpdates)
              url.searchParams.set("sendUpdates", params.sendUpdates);
            const body = {
              summary: params.summary,
              description: params.description,
              location: params.location,
              start: params.start,
              end: params.end,
              attendees: params.attendees,
              recurrence: params.recurrence,
              reminders: params.reminders,
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
          id: "update-event",
          displayName: "Update Event",
          description: "Update fields of an existing event (PATCH)",
          schema: z.object({
            calendarId: z.string().nonempty(),
            eventId: z.string().nonempty(),
            summary: z.string().optional(),
            description: z.string().optional(),
            location: z.string().optional(),
            start: eventDateSchema.optional(),
            end: eventDateSchema.optional(),
            attendees: z
              .array(
                z.object({
                  email: z.string().email(),
                  optional: z.boolean().optional(),
                })
              )
              .optional(),
            recurrence: z.array(z.string()).optional(),
            reminders: z
              .object({
                useDefault: z.boolean().optional(),
                overrides: z
                  .array(
                    z.object({
                      method: z.enum(["email", "popup"]),
                      minutes: z.number().int().min(0),
                    })
                  )
                  .optional(),
              })
              .optional(),
            sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_EVENTS,
            ]);
            const url = new URL(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                params.calendarId
              )}/events/${encodeURIComponent(params.eventId)}`
            );
            if (params.sendUpdates)
              url.searchParams.set("sendUpdates", params.sendUpdates);
            const body: Record<string, unknown> = {};
            if (params.summary !== undefined) body.summary = params.summary;
            if (params.description !== undefined)
              body.description = params.description;
            if (params.location !== undefined) body.location = params.location;
            if (params.start !== undefined) body.start = params.start;
            if (params.end !== undefined) body.end = params.end;
            if (params.attendees !== undefined)
              body.attendees = params.attendees;
            if (params.recurrence !== undefined)
              body.recurrence = params.recurrence;
            if (params.reminders !== undefined)
              body.reminders = params.reminders;
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
          id: "delete-event",
          displayName: "Delete Event",
          description: "Delete an event by ID",
          schema: z.object({
            calendarId: z.string().nonempty(),
            eventId: z.string().nonempty(),
            sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_EVENTS,
            ]);
            const url = new URL(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                params.calendarId
              )}/events/${encodeURIComponent(params.eventId)}`
            );
            if (params.sendUpdates)
              url.searchParams.set("sendUpdates", params.sendUpdates);
            const res = await fetch(url.toString(), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) {
              throw new ToolExecutionError(
                `${res.status} ${res.statusText}: ${await res.text()}`
              );
            }
            // DELETE returns empty body on success
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
          id: "move-event",
          displayName: "Move Event",
          description: "Move an event to a different calendar",
          schema: z.object({
            calendarId: z.string().nonempty().describe("Source calendar ID"),
            eventId: z.string().nonempty(),
            destination: z
              .string()
              .nonempty()
              .describe("Destination calendar ID"),
            sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
          }),
          execute: async (params) => {
            const accessToken = await googleAuth.ensureAccessToken([
              CALENDAR_SCOPE_EVENTS,
            ]);
            const url = new URL(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                params.calendarId
              )}/events/${encodeURIComponent(params.eventId)}/move`
            );
            url.searchParams.set("destination", params.destination);
            if (params.sendUpdates)
              url.searchParams.set("sendUpdates", params.sendUpdates);
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
