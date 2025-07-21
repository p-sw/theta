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

export abstract class API<T> {
  protected abstract readonly API_BASE_URL: string;
  protected apiKey!: string;

  protected abstract buildAPIRequest(
    method: RequestInit["method"]
  ): Omit<RequestInit, "body"> & { body?: Record<string, unknown> };
  protected abstract ensureSuccess(response: Response): Promise<void>;
  protected abstract translateSession(session: SessionTurns): T[];
  abstract message(
    session: SessionTurns,
    model: string,
    result: (updator: (message: IMessageResult[]) => void) => void, // prev -> new
    setStop: (stop: SessionTurnsResponse["stop"]) => void
  ): Promise<void>;
  abstract getModels(): Promise<IModelInfo[]>;
}

export type IMessageRequest = IMessageRequestText;

export interface IMessageRequestText {
  type: "text";
  text: string;
}

export type IMessageResult =
  | IMessageResultText
  | IMessageResultStart
  | IMessageResultEnd;

export interface IMessageResultText {
  type: "text";
  text: string;
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
  stop?: {
    reason: string;
    /**
     * error: the response was terminated due to an error
     * info: user should know, but not that important
     * subtext: user may want to know, but not that important
     * none: it will not be shown to the user
     */
    level: "error" | "info" | "subtext" | "none";
  };
};

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
export interface TemporarySession extends ISessionBase {}
