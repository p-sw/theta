import type { IModelInfo } from "@/sdk/types";
import type { Dispatch, SetStateAction } from "react";

export class ExpectedError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, type: string, message: string) {
    super(`(${type}) ${message}`);
    this.name = "UnexpectedError";
    this.statusCode = statusCode;
  }
}

export class UnexpectedMessageTypeError extends Error {
  readonly type: string;

  constructor(type: string) {
    super(`Unexpected message type: ${type}`);
    this.name = "UnexpectedMessageTypeError";
    this.type = type;
  }
}

export abstract class API {
  protected abstract readonly API_BASE_URL: string;
  protected apiKey!: string;

  protected abstract buildAPIRequest(
    method: RequestInit["method"]
  ): RequestInit;
  protected abstract ensureSuccess(response: Response): Promise<void>;
  abstract message(
    prompt: unknown, // different providers have different types
    model: string,
    result: Dispatch<SetStateAction<IMessageResult[]>>
  ): Promise<void>;
  abstract getModels(): Promise<IModelInfo[]>;
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
