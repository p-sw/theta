import type {
  IErrorBody,
  IListModelsBody,
  IMessage,
  IMessageResultContentBlockDelta,
  IMessageResultContentBlockStart,
} from "@/sdk/providers/anthropic.types";
import {
  API,
  ExpectedError,
  UnexpectedMessageTypeError,
  type IMessageResult,
  type IMessageResultText,
} from "@/sdk/shared";
import type { IModelInfo } from "@/sdk/types";
import type { Dispatch, SetStateAction } from "react";

function isErrorBody(body: unknown): body is IErrorBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const RecordStringUnknown = body as Record<string, unknown>;

  if (
    typeof RecordStringUnknown.type !== "string" ||
    RecordStringUnknown.type !== "error"
  ) {
    return false;
  }

  const error = RecordStringUnknown.error as Record<string, unknown>;

  if (typeof error.type !== "string" || typeof error.message !== "string") {
    return false;
  }

  return true;
}

export class AnthropicProvider extends API {
  protected readonly API_BASE_URL = "https://api.anthropic.com/v1";

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  protected buildAPIRequest(method: RequestInit["method"]): RequestInit {
    return {
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      method,
    };
  }

  protected async ensureSuccess(response: Response): Promise<void> {
    if (!response.ok) {
      const text = await response.text();
      let errorBody: IErrorBody;
      try {
        errorBody = JSON.parse(text);
      } catch {
        // common http error
        throw new ExpectedError(
          response.status,
          "common_http_error",
          response.statusText
        );
      }

      if (isErrorBody(errorBody)) {
        // anthropic error
        throw new ExpectedError(
          response.status,
          `anthropic_error`,
          `[Anthropic] ${errorBody.error.type}: ${errorBody.error.message}`
        );
      }

      // unknown error
      throw new ExpectedError(response.status, "unknown_error", text);
    }
  }

  async getModels(): Promise<IModelInfo[]> {
    // get models from API
    const response = await fetch(
      this.API_BASE_URL + "/models",
      this.buildAPIRequest("GET")
    );

    await this.ensureSuccess(response);

    const body = (await response.json()) as IListModelsBody;

    return body.data.map((model) => ({
      provider: "anthropic",
      id: model.id,
      displayName: model.display_name,
      disabled: false,
    }));
  }

  async message(
    messages: IMessage[],
    model: string,
    result: Dispatch<SetStateAction<IMessageResult[]>>
  ): Promise<void> {
    const response = await fetch(this.API_BASE_URL + "/messages", {
      ...this.buildAPIRequest("POST"),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages,
        stream: true,
        system: [
          {
            type: "text",
            text: "Today's datetime is " + new Date().toISOString(),
          },
        ],
      }),
    });

    await this.ensureSuccess(response);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ExpectedError(
        response.status,
        "common_http_error",
        "No reader"
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() && line.startsWith("data: ")) {
            const data = line.slice(6);

            try {
              const event = JSON.parse(data);

              // handling:
              // - ping
              // - message_start
              // - message_stop
              // - content_block_start
              // - content_block_delta
              // - content_block_stop
              // - message_delta - todo
              switch (event.type) {
                case "ping":
                  console.log("pong!");
                  break;
                case "message_start":
                  result((prev) => [
                    ...prev,
                    {
                      type: "start",
                    },
                  ]);
                  break;
                case "message_stop":
                  result((prev) => [
                    ...prev,
                    {
                      type: "end",
                    },
                  ]);
                  break;
                case "content_block_start":
                  result((prev) => [
                    ...prev,
                    {
                      type: "text",
                      text: (event as IMessageResultContentBlockStart)
                        .content_block.text,
                    },
                  ]);
                  break;
                case "content_block_delta":
                  result((prev) => [
                    ...prev.slice(0, event.index),
                    {
                      type: "text",
                      text:
                        (prev[event.index] as IMessageResultText).text +
                        (event as IMessageResultContentBlockDelta).delta.text,
                    },
                    ...prev.slice(event.index + 1),
                  ]);
                  break;
                case "content_block_stop":
                case "message_delta":
                  break;
                default:
                  throw new UnexpectedMessageTypeError(event.type);
              }
            } catch (e) {
              console.error("JSON 파싱 에러:", e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
