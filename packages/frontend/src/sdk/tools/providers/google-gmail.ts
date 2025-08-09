import type { IConfigSchema, ITool, IToolProvider } from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IGoogleGmailConfig } from "@/sdk/tools/providers/google-gmail.types";
import { googleAuth } from "@/sdk/tools/providers/google-auth";
import z from "zod";

const GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SCOPE_MODIFY = "https://www.googleapis.com/auth/gmail.modify";
const GMAIL_SCOPE_SEND = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_SCOPE_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";

function base64UrlEncode(input: string): string {
  const encoded = btoa(unescape(encodeURIComponent(input)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildMimeMessage(params: {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  replyTo?: string;
  bodyText?: string;
  bodyHtml?: string;
  headers?: Record<string, string>;
  references?: string[];
  inReplyTo?: string;
}): string {
  const lines: string[] = [];

  const toHeader = params.to.join(", ");
  const ccHeader = params.cc && params.cc.length ? `\r\nCc: ${params.cc.join(", ")}` : "";
  const bccHeader = params.bcc && params.bcc.length ? `\r\nBcc: ${params.bcc.join(", ")}` : "";
  const fromHeader = params.from ? `\r\nFrom: ${params.from}` : "";
  const replyToHeader = params.replyTo ? `\r\nReply-To: ${params.replyTo}` : "";
  const referencesHeader = params.references && params.references.length
    ? `\r\nReferences: ${params.references.join(" ")}`
    : "";
  const inReplyToHeader = params.inReplyTo ? `\r\nIn-Reply-To: ${params.inReplyTo}` : "";

  // Additional custom headers
  let extraHeaders = "";
  if (params.headers) {
    for (const [k, v] of Object.entries(params.headers)) {
      extraHeaders += `\r\n${k}: ${v}`;
    }
  }

  if (params.bodyHtml) {
    const altBoundary = "alt_" + Math.random().toString(36).slice(2);
    lines.push(
      `To: ${toHeader}${ccHeader}${bccHeader}${fromHeader}${replyToHeader}\r\nSubject: ${params.subject}${referencesHeader}${inReplyToHeader}${extraHeaders}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"${altBoundary}\"\r\n\r\n` +
        `--${altBoundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${params.bodyText ?? ""}\r\n\r\n` +
        `--${altBoundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${params.bodyHtml}\r\n\r\n` +
        `--${altBoundary}--`
    );
  } else {
    const textBody = params.bodyText ?? "";
    lines.push(
      `To: ${toHeader}${ccHeader}${bccHeader}${fromHeader}${replyToHeader}\r\nSubject: ${params.subject}${referencesHeader}${inReplyToHeader}${extraHeaders}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${textBody}`
    );
  }

  return lines.join("\r\n");
}

export class GoogleGmailProvider implements IToolProvider<IGoogleGmailConfig> {
  static id = "google-gmail";
  id = "google-gmail";
  displayName = "Gmail";
  description = "Read, send, draft, label, move, and manage Gmail";

  private configSchema: Record<keyof IGoogleGmailConfig, IConfigSchema> = {
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
        "Google API Key (optional for Gmail with OAuth, but useful for other Google APIs)",
    },
  };

  private configSchemaZod = z.object({
    clientId: z.string().nonempty(),
    apiKey: z.string().nonempty(),
  });

  setup(config: IGoogleGmailConfig) {
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

  getDefaultConfig(): IGoogleGmailConfig {
    return { clientId: "", apiKey: "" };
  }

  getConfigSchema(): [
    Record<keyof IGoogleGmailConfig, IConfigSchema>,
    z.ZodSchema<IGoogleGmailConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      const messageIdSchema = z.string().nonempty().describe("Gmail message ID");
      const threadIdSchema = z.string().nonempty().describe("Gmail thread ID");
      const labelIdSchema = z.string().nonempty().describe("Gmail label ID");

      const listPaginationSchema = z.object({
        maxResults: z.number().int().min(1).max(500).optional(),
        pageToken: z.string().optional(),
        includeSpamTrash: z.boolean().optional(),
      });

      const listTools: ITool[] = [
        {
          id: "list-labels",
          displayName: "List Labels",
          description: "List Gmail labels",
          schema: z.object({}),
          execute: async () => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_READONLY]);
            const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
              headers: { Authorization: `Bearer ${token}` },
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
              if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "list-messages",
          displayName: "List Messages",
          description: "List message IDs by query and/or labels",
          schema: listPaginationSchema.extend({
            q: z.string().optional().describe("Gmail search query, e.g., 'from:me has:attachment'"),
            labelIds: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_READONLY]);
            const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
            if (params.q) url.searchParams.set("q", params.q);
            if (params.labelIds) for (const l of params.labelIds) url.searchParams.append("labelIds", l);
            if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
            if (params.includeSpamTrash !== undefined)
              url.searchParams.set("includeSpamTrash", String(params.includeSpamTrash));
            const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "list-threads",
          displayName: "List Threads",
          description: "List thread IDs by query and/or labels",
          schema: listPaginationSchema.extend({
            q: z.string().optional(),
            labelIds: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_READONLY]);
            const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
            if (params.q) url.searchParams.set("q", params.q);
            if (params.labelIds) for (const l of params.labelIds) url.searchParams.append("labelIds", l);
            if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
            if (params.includeSpamTrash !== undefined)
              url.searchParams.set("includeSpamTrash", String(params.includeSpamTrash));
            const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
      ];

      const getTools: ITool[] = [
        {
          id: "get-message",
          displayName: "Get Message",
          description: "Fetch a message with selectable format",
          schema: z.object({
            id: messageIdSchema,
            format: z.enum(["full", "metadata", "raw", "minimal"]).optional().default("full"),
            metadataHeaders: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_READONLY]);
            const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}`);
            if (params.format) url.searchParams.set("format", params.format);
            if (params.metadataHeaders)
              for (const h of params.metadataHeaders) url.searchParams.append("metadataHeaders", h);
            const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "get-thread",
          displayName: "Get Thread",
          description: "Fetch a thread by ID",
          schema: z.object({ id: threadIdSchema }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_READONLY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(params.id)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
      ];

      const sendAndDraftTools: ITool[] = [
        {
          id: "send-message",
          displayName: "Send Email",
          description: "Send an email with optional HTML and threading",
          schema: z.object({
            to: z.array(z.string().email()).nonempty(),
            cc: z.array(z.string().email()).optional(),
            bcc: z.array(z.string().email()).optional(),
            subject: z.string().default("") ,
            bodyText: z.string().optional(),
            bodyHtml: z.string().optional(),
            headers: z.record(z.string(), z.string()).optional(),
            from: z.string().email().optional(),
            replyTo: z.string().email().optional(),
            references: z.array(z.string()).optional(),
            inReplyTo: z.string().optional(),
            threadId: z.string().optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_SEND, GMAIL_SCOPE_COMPOSE]);
            const mime = buildMimeMessage(params);
            const raw = base64UrlEncode(mime);
            const body: Record<string, unknown> = { raw };
            if (params.threadId) body.threadId = params.threadId;
            const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "create-draft",
          displayName: "Create Draft",
          description: "Create a draft email",
          schema: z.object({
            to: z.array(z.string().email()).nonempty(),
            cc: z.array(z.string().email()).optional(),
            bcc: z.array(z.string().email()).optional(),
            subject: z.string().default("") ,
            bodyText: z.string().optional(),
            bodyHtml: z.string().optional(),
            headers: z.record(z.string(), z.string()).optional(),
            from: z.string().email().optional(),
            replyTo: z.string().email().optional(),
            references: z.array(z.string()).optional(),
            inReplyTo: z.string().optional(),
            threadId: z.string().optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_COMPOSE]);
            const mime = buildMimeMessage(params);
            const raw = base64UrlEncode(mime);
            const body: Record<string, unknown> = { message: { raw } };
            if (params.threadId) (body.message as Record<string, unknown>).threadId = params.threadId;
            const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "list-drafts",
          displayName: "List Drafts",
          description: "List draft IDs",
          schema: listPaginationSchema,
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_COMPOSE]);
            const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/drafts");
            if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));
            if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
            const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "send-draft",
          displayName: "Send Draft",
          description: "Send a draft by ID",
          schema: z.object({ id: z.string().nonempty() }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_SEND, GMAIL_SCOPE_COMPOSE]);
            const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ id: params.id }),
            });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
      ];

      const mutationTools: ITool[] = [
        {
          id: "delete-message",
          displayName: "Delete Message",
          description: "Permanently delete a message",
          schema: z.object({ id: messageIdSchema }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return "";
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "trash-message",
          displayName: "Trash Message",
          description: "Move a message to Trash",
          schema: z.object({ id: messageIdSchema }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}/trash`,
              { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "untrash-message",
          displayName: "Untrash Message",
          description: "Restore a message from Trash",
          schema: z.object({ id: messageIdSchema }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}/untrash`,
              { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "modify-message-labels",
          displayName: "Modify Message Labels",
          description: "Add or remove labels from a message",
          schema: z.object({
            id: messageIdSchema,
            addLabelIds: z.array(z.string()).optional(),
            removeLabelIds: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}/modify`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ addLabelIds: params.addLabelIds ?? [], removeLabelIds: params.removeLabelIds ?? [] }),
              }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "batch-modify-labels",
          displayName: "Batch Modify Labels",
          description: "Add or remove labels on multiple messages",
          schema: z.object({
            ids: z.array(z.string().nonempty()).nonempty(),
            addLabelIds: z.array(z.string()).optional(),
            removeLabelIds: z.array(z.string()).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ids: params.ids, addLabelIds: params.addLabelIds ?? [], removeLabelIds: params.removeLabelIds ?? [] }),
            });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return "";
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "move-message",
          displayName: "Move Message",
          description: "Move a message by adding a destination label and removing INBOX",
          schema: z.object({
            id: messageIdSchema,
            destinationLabelId: labelIdSchema,
            removeFromInbox: z.boolean().optional().default(true),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const remove = params.removeFromInbox ? ["INBOX"] : [];
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.id)}/modify`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ addLabelIds: [params.destinationLabelId], removeLabelIds: remove }),
              }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
      ];

      const labelTools: ITool[] = [
        {
          id: "create-label",
          displayName: "Create Label",
          description: "Create a new user label",
          schema: z.object({
            name: z.string().nonempty(),
            labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
            messageListVisibility: z.enum(["show", "hide"]).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ name: params.name, labelListVisibility: params.labelListVisibility, messageListVisibility: params.messageListVisibility }),
            });
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "update-label",
          displayName: "Update Label",
          description: "Update a user label",
          schema: z.object({
            id: labelIdSchema,
            name: z.string().optional(),
            labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
            messageListVisibility: z.enum(["show", "hide"]).optional(),
          }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const body: Record<string, unknown> = {};
            if (params.name !== undefined) body.name = params.name;
            if (params.labelListVisibility !== undefined)
              body.labelListVisibility = params.labelListVisibility;
            if (params.messageListVisibility !== undefined)
              body.messageListVisibility = params.messageListVisibility;
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(params.id)}`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return await res.text();
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
        {
          id: "delete-label",
          displayName: "Delete Label",
          description: "Delete a user label",
          schema: z.object({ id: labelIdSchema }),
          execute: async (params) => {
            const token = await googleAuth.ensureAccessToken([GMAIL_SCOPE_MODIFY]);
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(params.id)}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new ToolExecutionError(`${res.status} ${res.statusText}: ${await res.text()}`);
            return "";
          },
          async ensureParameters(parameters) {
            try { await this.schema.parseAsync(parameters); }
            catch (e) { if (e instanceof z.ZodError) throw new ToolParameterError(JSON.stringify(z.treeifyError(e))); throw new ToolParameterError((e as Error).message); }
          },
        },
      ];

      this._tools = [
        ...listTools,
        ...getTools,
        ...sendAndDraftTools,
        ...mutationTools,
        ...labelTools,
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