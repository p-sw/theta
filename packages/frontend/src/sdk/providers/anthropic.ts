import { proxyfetch, ServerSideHttpError } from "@/lib/proxy";
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
  type IMessageResult,
  type IMessageResultText,
} from "@/sdk/shared";
import type { IModelInfo, Session } from "@/sdk/shared";

export class AnthropicUnexpectedMessageTypeError extends Error {
  readonly type: string;

  constructor(type: string) {
    super(`[Anthropic] Unexpected message type: ${type}`);
    this.name = "AnthropicUnexpectedMessageTypeError";
    this.type = type;
  }
}

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

export class AnthropicProvider extends API<IMessage> {
  protected readonly API_BASE_URL = "https://api.anthropic.com/v1";

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  protected buildAPIRequest(
    method: RequestInit["method"]
  ): Omit<RequestInit, "body"> & { body?: Record<string, unknown> } {
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
        // server-side http error
        throw new ServerSideHttpError(response.status, response.statusText);
      }

      if (isErrorBody(errorBody)) {
        // anthropic error
        throw new ExpectedError(
          response.status,
          errorBody.error.type,
          `[Anthropic] ${errorBody.error.type}: ${errorBody.error.message}`
        );
      }

      // unknown error
      throw new ServerSideHttpError(response.status, response.statusText);
    }
  }

  protected translateSession(session: Session): IMessage[] {
    const messages: IMessage[] = [];

    for (const turn of session) {
      const message: IMessage = {
        role: turn.type === "request" ? "user" : "assistant",
        content: [],
      };
      for (const turnPartial of turn.message) {
        switch (turnPartial.type) {
          case "text":
            message.content.push({ type: "text", text: turnPartial.text });
            break;
          case "start":
          case "end":
            break;
          default:
            console.warn(
              "[Anthropic] Unexpected message type while translating session:",
              turnPartial
            );
        }
      }
      messages.push(message);
    }

    return messages;
  }

  async getModels(): Promise<IModelInfo[]> {
    // get models from API
    const response = await proxyfetch(
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
    session: Session,
    model: string,
    result: (updator: (message: IMessageResult[]) => void) => void
  ): Promise<void> {
    const messages = this.translateSession(session);

    const response = await proxyfetch(this.API_BASE_URL + "/messages", {
      ...this.buildAPIRequest("POST"),
      body: {
        model,
        max_tokens: 1024,
        messages,
        stream: true,
        system: [
          {
            type: "text",
            text: "Today's datetime is " + new Date().toISOString(),
          },
        ],
      },
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
    // actual index of content block in message result
    const contentBlockMap: Record<number, number> = {};

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
                  result((prev) => prev.push({ type: "start" }));
                  break;
                case "message_stop":
                  result((prev) => prev.push({ type: "end" }));
                  break;
                case "content_block_start":
                  result((prev) => {
                    const index = (event as IMessageResultContentBlockStart)
                      .index;
                    contentBlockMap[index] = prev.length;
                    prev.push({
                      type: "text",
                      text: (event as IMessageResultContentBlockStart)
                        .content_block.text,
                    });
                  });
                  break;
                case "content_block_delta":
                  result((prev) => {
                    const index = (event as IMessageResultContentBlockDelta)
                      .index;
                    const actualIndex = contentBlockMap[index];
                    prev[actualIndex] = {
                      type: "text",
                      text:
                        (prev[actualIndex] as IMessageResultText).text +
                        (event as IMessageResultContentBlockDelta).delta.text,
                    };
                  });
                  break;
                case "content_block_stop":
                case "message_delta":
                  break;
                default:
                  throw new AnthropicUnexpectedMessageTypeError(event.type);
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
