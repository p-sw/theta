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
  ): RequestInit;
  protected abstract ensureSuccess(response: Response): Promise<void>;
  protected abstract translateRequestMessage(message: IMessageRequest[]): T[];
  abstract message(
    session: Session,
    model: string,
    result: (updator: (message: IMessageResult[]) => IMessageResult[]) => void // prev -> new
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

export type Session = (
  | {
      type: "request";
      message: IMessageRequest[];
    }
  | {
      type: "response";
      message: IMessageResult[];
    }
)[];
