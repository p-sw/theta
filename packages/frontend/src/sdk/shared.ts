import type z from "zod";
import type { JSONSchema7 } from "json-schema";

export type IProvider = "anthropic";
export interface IProviderInfo {
  id: IProvider;
  displayName: string;
}

export class ExpectedError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, type: string, message: string) {
    super(`(${type}) ${message}`);
    this.name = "ExpectedError";
    this.statusCode = statusCode;
  }
}

export interface ISystemPrompt {
  systemPrompts: string[];
}

export abstract class API<ProviderSession, ProviderToolSchema> {
  protected abstract readonly API_BASE_URL: string;
  protected apiKey!: string;

  protected abstract buildAPIRequest(
    method: RequestInit["method"]
  ): Omit<RequestInit, "body"> & { body?: Record<string, unknown> };
  protected abstract ensureSuccess(response: Response): Promise<void>;
  protected abstract translateSession(session: SessionTurns): ProviderSession[];
  protected abstract translateToolSchema(
    schema: IToolSchemaRegistry
  ): ProviderToolSchema[];
  abstract message(
    session: SessionTurns,
    model: string,
    result: (
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) => Promise<void>, // prev -> new
    setStop: (stop: SessionTurnsResponse["stop"]) => void
  ): Promise<void>;
  abstract getModels(): Promise<IModelInfo[]>;
  abstract getDefaultModelConfig(modelId: string): object;
  abstract getModelConfigSchema(
    modelId: string
  ): [Record<string, IConfigSchema>, z.ZodSchema];
  protected abstract getModelConfig(modelId: string): object;
}

export type IConfigSchema =
  | IConfigSchemaNumber
  | IConfigSchemaString
  | IConfigSchemaBoolean
  | IConfigSchemaArray;

export interface IConfigSchemaBase {
  displayName: string;
  description: string;
  disabled?: boolean | { $ref: string; not?: boolean };
}

export interface IConfigSchemaNumber extends IConfigSchemaBase {
  type: "number";
  min: number | { $ref: string };
  max: number | { $ref: string };
  step: number;
}

export interface IConfigSchemaString extends IConfigSchemaBase {
  type: "string" | "textarea";
}

export interface IConfigSchemaBoolean extends IConfigSchemaBase {
  type: "boolean";
}

export interface IConfigSchemaArray extends IConfigSchemaBase {
  type: "array";
  items: Omit<IConfigSchema, "displayName" | "description">;
}

export interface IToolSchema {
  name: string;
  description: string;
  parameters: JSONSchema7;
}

export type IToolSchemaRegistry = IToolSchema[];

export type IMessageRequest = IMessageRequestText;

export interface IMessageRequestText {
  type: "text";
  text: string;
}

export type IMessageResult =
  | IMessageResultText
  | IMessageResultStart
  | IMessageResultEnd
  | IMessageResultThinking;

export interface IMessageResultText {
  type: "text";
  text: string;
}

export interface IMessageResultThinking {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface IMessageResultStart {
  type: "start";
}

export interface IMessageResultEnd {
  type: "end";
}

export interface IModelInfo {
  provider: IProvider;
  id: string;
  displayName: string;
  disabled: boolean;
}

export type SessionTurnsRequest = {
  type: "request";
  messageId: string;
  message: IMessageRequest[];
};

export type SessionTurnsResponse = {
  type: "response";
  messageId: string;
  message: IMessageResult[];
  stop?: SessionTurnsResponseStop;
};

export type SessionTurnsResponseStop =
  | SessionTurnsResponseStopMessage
  | SessionTurnsResponseStopLog;

/**
 * Messages that are shown to the user
 */
export interface SessionTurnsResponseStopMessage {
  type: "message";
  reason: string;
  /**
   * error: the response was terminated due to an error
   * info: user should know, but not that important
   * subtext: user may want to know, but not that important
   * none: it will not be shown to the user
   */
  level: "error" | "info" | "subtext";
}

/**
 * Logs that are not shown to the user
 */
export interface SessionTurnsResponseStopLog {
  type: "log";
  message: string;
}

export type SessionTurns = (SessionTurnsRequest | SessionTurnsResponse)[];
export interface ISessionBase {
  id: string;
  turns: SessionTurns;
  createdAt: number;
  updatedAt: number;
}
export interface PermanentSession extends ISessionBase {
  title: string;
}
export interface TemporarySession extends ISessionBase {
  title: string;
}
