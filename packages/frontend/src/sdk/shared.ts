import type { JSONSchema7 } from "json-schema";
import type z from "zod";

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

  /**
   * Update the API key for the provider instance at runtime.
   * This enables hot-swapping credentials when the user edits them in settings.
   */
  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  protected abstract buildAPIRequest(
    method: RequestInit["method"]
  ): Omit<RequestInit, "body"> & { body?: Record<string, unknown> };
  protected abstract ensureSuccess(response: Response): Promise<void>;
  protected abstract translateSession(session: SessionTurns): ProviderSession[];
  protected abstract translateToolSchema(
    schema: IToolMetaJson[]
  ): ProviderToolSchema[];
  abstract message(
    session: SessionTurns,
    model: string,
    result: (
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) => Promise<void>, // prev -> new
    setStop: (stop: SessionTurnsResponse["stop"]) => void,
    tools: IToolMetaJson[],
    signal?: AbortSignal
  ): Promise<void>;
  abstract getModels(modelId: string): Promise<IModelInfo[]>;
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
  | IConfigSchemaArray
  | IConfigSchemaEnum
  | IConfigSchemaEnumGroup;

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

export interface IConfigSchemaEnum extends IConfigSchemaBase {
  type: "enum";
  placeholder: string;
  items: { name: string; value: string }[];
}

export interface IConfigSchemaEnumGroup extends IConfigSchemaBase {
  type: "enumgroup";
  placeholder: string;
  items: {
    label: string;
    items: { name: string; value: string }[];
  }[];
}

export interface ITool extends IToolMeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (parameters: any) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensureParameters(parameters: any): Promise<void>;
}

export interface IToolMeta {
  id: string;
  displayName: string;
  description: string;
  schema: z.ZodSchema; // use z.toJSONSchema to get JSON schema
}

export interface IToolMetaJson extends IToolMeta {
  jsonSchema: JSONSchema7;
}

export interface IToolProviderMeta {
  id: string;
  displayName: string;
  description: string;
}

export interface IToolProvider<T> extends IToolProviderMeta {
  setup: (config: T) => void;
  getDefaultConfig(): T;
  getConfigSchema(): [Record<keyof T, IConfigSchema>, z.ZodSchema<T>];
  tools: ITool[];
  execute(toolId: string, parameters: unknown): Promise<string>;
}

export interface IToolRegistry {
  get(providerToolId: string): IToolMetaJson | undefined;
  get(providerId: string, toolId: string): IToolMetaJson | undefined;
  getAll(providerId: string): IToolMetaJson[];
  getAll(): IToolMetaJson[];
  getEnabledTools(): IToolMetaJson[];
  getEnabledTools(providerId: string): IToolMetaJson[];
  isToolEnabled(providerToolId: string): boolean;
  isToolEnabled(providerId: string, toolId: string): boolean;
  execute(providerToolId: string, parameters: unknown): Promise<string>;

  getProviders(): IToolProviderMeta[];
  isProviderAvailable(providerId: string): boolean;
  getProviderConfig(
    providerId: string
  ): [object, Record<string, IConfigSchema>, z.ZodSchema<object>];
}

export type IMessageRequest = IMessageRequestText | IMessageRequestToolResult;

export interface IMessageRequestText {
  type: "text";
  text: string;
}

export interface IMessageRequestToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export type IMessageResult =
  | IMessageResultText
  | IMessageResultStart
  | IMessageResultEnd
  | IMessageResultThinking
  | IMessageResultToolUse;

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

export interface IMessageResultToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: string;
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
  | SessionTurnsResponseStopLog
  | SessionTurnsResponseStopToolUse;

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

export interface SessionTurnsResponseStopToolUse {
  type: "tool_use";
}

export interface SessionTurnsToolBase {
  type: "tool";
  useId: string;
  toolName: string;
  granted: boolean;
}

export interface SessionTurnsToolInProgress extends SessionTurnsToolBase {
  done: false;
  requestContent: string;
}

export interface SessionTurnsToolDone extends SessionTurnsToolBase {
  done: true;
  requestContent: string;
  responseContent: string;
  isError: boolean;
}

export type SessionTurnsTool =
  | SessionTurnsToolInProgress
  | SessionTurnsToolDone;

export type SessionTurns = (
  | SessionTurnsRequest
  | SessionTurnsResponse
  | SessionTurnsTool
)[];

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
