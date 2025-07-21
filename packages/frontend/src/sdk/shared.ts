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
    result: (updator: (message: IMessageResult[]) => void) => void // prev -> new
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

export type SessionTurns = (
  | {
      type: "request";
      messageId: string;
      message: IMessageRequest[];
    }
  | {
      type: "response";
      messageId: string;
      message: IMessageResult[];
    }
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
export interface TemporarySession extends ISessionBase {}
