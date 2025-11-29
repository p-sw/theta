import { PER_MODEL_CONFIG_KEY, SYSTEM_PROMPTS_KEY } from "@/lib/const";
import { proxyfetch, ServerSideHttpError } from "@/lib/proxy";
import type {
  IAnthropicToolSchema,
  IAnthropicErrorBody,
  IAnthropicMessage,
  IAnthropicMessageResultData,
  IAnthropicMessageResultMessageDelta,
  IAnthropicMessageResultMessageStart,
  IAnthropicModelConfig,
} from "@/sdk/providers/anthropic.types";
import type {
  IMessageResultThinking,
  IModelInfo,
  SessionTurns,
  IToolMetaJson,
  IMessageResultToolUse,
} from "@/sdk/shared";
import {
  API,
  ExpectedError,
  SessionTranslationError,
  type IMessageResult,
  type IMessageResultText,
  type SessionTurnsResponse,
} from "@/sdk/shared";

const AnthropicModelRegistry: {
  id: string;
  displayName: string;
  extendedThinking: boolean;
  contextWindow: number;
  maxOutput: number;
  pricing: {
    baseInput: number; // $/1M tokens
    output: number; // $/1M tokens
    mCacheWrite: number; // 5m Cache Write, $/1M tokens
    hCacheWrite: number; // 1h Cache Write, $/1M tokens
    cacheHitRefresh: number; // Cache Hit Refresh, $/1M tokens
  };
}[] = [
  {
    id: "claude-3-haiku-20240307",
    displayName: "Claude Haiku 3",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 4096,
    pricing: {
      baseInput: 0.25,
      mCacheWrite: 0.3,
      hCacheWrite: 0.5,
      cacheHitRefresh: 0.03,
      output: 1.25,
    },
  },
  {
    id: "claude-3-opus-20240229",
    displayName: "Claude Opus 3",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 4096,
    pricing: {
      baseInput: 15,
      mCacheWrite: 18.75,
      hCacheWrite: 30,
      cacheHitRefresh: 1.5,
      output: 75,
    },
  },
  {
    id: "claude-3-5-haiku-20241022",
    displayName: "Claude Haiku 3.5",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 8192,
    pricing: {
      baseInput: 0.8,
      mCacheWrite: 1,
      hCacheWrite: 1.6,
      cacheHitRefresh: 0.08,
      output: 4,
    },
  },
  {
    id: "claude-3-5-sonnet-20241022",
    displayName: "Claude Sonnet 3.5",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 8192,
    pricing: {
      baseInput: 3,
      mCacheWrite: 3.75,
      hCacheWrite: 6,
      cacheHitRefresh: 0.3,
      output: 15,
    },
  },
  {
    id: "claude-3-7-sonnet-20250219",
    displayName: "Claude Sonnet 3.7",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 64000,
    pricing: {
      baseInput: 3,
      mCacheWrite: 3.75,
      hCacheWrite: 6,
      cacheHitRefresh: 0.3,
      output: 15,
    },
  },
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 64000,
    pricing: {
      baseInput: 3,
      mCacheWrite: 3.75,
      hCacheWrite: 6,
      cacheHitRefresh: 0.3,
      output: 15,
    },
  },
  {
    id: "claude-opus-4-20250514",
    displayName: "Claude Opus 4",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 32000,
    pricing: {
      baseInput: 15,
      mCacheWrite: 18.75,
      hCacheWrite: 30,
      cacheHitRefresh: 1.5,
      output: 75,
    },
  },
];

export class AnthropicUnexpectedMessageTypeError extends Error {
  readonly type: string;

  constructor(type: string) {
    super(`[Anthropic] Unexpected message type: ${type}`);
    this.name = "AnthropicUnexpectedMessageTypeError";
    this.type = type;
  }
}

function isErrorBody(body: unknown): body is IAnthropicErrorBody {
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

export class AnthropicProvider extends API<
  IAnthropicMessage,
  IAnthropicToolSchema
> {
  protected readonly API_BASE_URL = "https://api.anthropic.com/v1";

  constructor(apiKey: string) {
    super();
    // Delegate API-key assignment to the common helper defined in API base.
    this.setApiKey(apiKey);
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
      let errorBody: IAnthropicErrorBody;
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

  protected translateSession(session: SessionTurns): IAnthropicMessage[] {
    const messages: IAnthropicMessage[] = [];

    for (const turn of session) {
      if (turn.type === "tool" || turn.type === "request") {
        const lastMessage = messages.at(-1);
        let message: IAnthropicMessage;
        if (lastMessage?.role === "user") {
          message = lastMessage;
        } else {
          message = {
            role: "user",
            content: [],
          };
          messages.push(message);
        }
        if (turn.type === "tool") {
          if (!turn.done)
            throw new SessionTranslationError(
              `Tool is not done: ${turn.useId} ${turn.toolName}`
            );
          message.content.push({
            type: "tool_result",
            tool_use_id: turn.useId,
            content: turn.responseContent,
            is_error: turn.isError,
          });
        }
        if (turn.type === "request") {
          for (const turnPartial of turn.message) {
            switch (turnPartial.type) {
              case "text":
                message.content.push({ type: "text", text: turnPartial.text });
                break;
              default:
                console.warn(
                  "[Anthropic] Unexpected message type while translating session:",
                  turnPartial
                );
            }
          }
        }
      }
      if (turn.type === "response") {
        const message: IAnthropicMessage = {
          role: "assistant",
          content: [],
        };
        messages.push(message);

        for (const turnPartial of turn.message) {
          switch (turnPartial.type) {
            case "text":
              message.content.push({ type: "text", text: turnPartial.text });
              break;
            case "thinking":
              if (!turnPartial.signature) {
                throw new SessionTranslationError(
                  `Thinking signature is missing in ${JSON.stringify(
                    turnPartial
                  )}`
                );
              }
              message.content.push({
                type: "thinking",
                thinking: turnPartial.thinking,
                signature: turnPartial.signature,
              });
              break;
            case "tool_use":
              try {
                message.content.push({
                  type: "tool_use",
                  id: turnPartial.id,
                  input: JSON.parse(turnPartial.input),
                  name: turnPartial.name,
                });
              } catch {
                message.content.push({
                  type: "tool_use",
                  id: turnPartial.id,
                  input: {},
                  name: turnPartial.name,
                });
              }
              break;
            case "start":
            case "end":
            case "refusal":
              break;
            default:
              console.warn(
                "[Anthropic] Unexpected message type while translating session:",
                turnPartial
              );
          }
        }
      }
    }

    return messages;
  }

  protected translateToolSchema(
    schema: IToolMetaJson[]
  ): IAnthropicToolSchema[] {
    return schema.map((tool) => ({
      name: tool.id,
      description: tool.description,
      input_schema: tool.jsonSchema,
    }));
  }

  async getModels(): Promise<IModelInfo[]> {
    return AnthropicModelRegistry.map((model) => ({
      provider: "anthropic",
      id: model.id,
      displayName: model.displayName,
      disabled: false,
    }));
  }

  async message(
    session: SessionTurns,
    model: string,
    result: (
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) => Promise<void>,
    setStop: (stop: SessionTurnsResponse["stop"]) => void,
    tools: IToolMetaJson[],
    onUsage: (delta: {
      inputTokensDelta?: number;
      outputTokensDelta?: number;
    }) => void,
    overrideConfigs?: Partial<IAnthropicModelConfig & { system: string }>,
    signal?: AbortSignal
  ): Promise<void> {
    const messages = this.translateSession(session);
    const modelConfig = { ...this.getModelConfig(model), ...overrideConfigs };

    // Get system prompts from localStorage
    const systemPrompts = [
      {
        type: "text" as const,
        text: "Today's datetime is " + new Date().toISOString(),
      },
    ];
    if (overrideConfigs?.system) {
      systemPrompts.push({
        type: "text" as const,
        text: overrideConfigs?.system
      })
    }

    try {
      const systemPromptsString = localStorage.getItem(SYSTEM_PROMPTS_KEY);
      if (systemPromptsString) {
        const systemPromptsData = JSON.parse(systemPromptsString);
        if (
          systemPromptsData.systemPrompts &&
          Array.isArray(systemPromptsData.systemPrompts)
        ) {
          // Add user-defined system prompts
          systemPromptsData.systemPrompts.forEach((prompt: string) => {
            if (prompt.trim()) {
              systemPrompts.push({
                type: "text" as const,
                text: prompt,
              });
            }
          });
        }
      }
    } catch (e) {
      console.error("Error parsing system prompts:", e);
    }

    const response = await proxyfetch(this.API_BASE_URL + "/messages", {
      ...this.buildAPIRequest("POST"),
      body: {
        model,
        max_tokens: modelConfig.maxOutput,
        temperature: !modelConfig.extendedThinking
          ? modelConfig.temperature
          : 1,
        stop_sequences: modelConfig.stopSequences,
        messages,
        stream: true,
        system: systemPrompts,
        ...(modelConfig.extendedThinking
          ? {
              thinking: {
                type: "enabled",
                budget_tokens: modelConfig.thinkingBudget,
              },
            }
          : {}),
        tools: this.translateToolSchema(tools),
      },
      signal,
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
              const event = JSON.parse(data) as IAnthropicMessageResultData;
              if (isErrorBody(event)) {
                setStop({
                  type: "message",
                  reason: `[Anthropic] ${event.error.type}: ${event.error.message}`,
                  level: "error",
                });
                await result(async (prev) => prev.push({ type: "end" }));
                throw new ExpectedError(
                  response.status,
                  event.error.type,
                  `[Anthropic] ${event.error.type}: ${event.error.message}`
                );
              }
              if (event.type === "ping") {
                // no-op
              } else if (event.type === "message_start") {
                // start of message and initial usage (if provided)
                result(async (prev) => prev.push({ type: "start" }));
                const usage = (event as IAnthropicMessageResultMessageStart)
                  .message.usage;
                if (usage) {
                  onUsage({
                    inputTokensDelta: usage.input_tokens ?? 0,
                    outputTokensDelta: usage.output_tokens ?? 0,
                  });
                }
              } else if (event.type === "message_stop") {
                result(async (prev) => prev.push({ type: "end" }));
              } else if (event.type === "message_delta") {
                // Track usage deltas when available
                if (event.usage) {
                  onUsage({
                    inputTokensDelta: event.usage.input_tokens ?? 0,
                    outputTokensDelta: event.usage.output_tokens ?? 0,
                  });
                }
                switch (event.delta.stop_reason) {
                  case "end_turn":
                    setStop({
                      type: "log",
                      message: "Assistant has finished its turn.",
                    });
                    break;
                  case "max_tokens":
                    setStop({
                      type: "message",
                      reason:
                        "The response reached the maximum number of tokens.",
                      level: "error",
                    });
                    break;
                  case "stop_sequence":
                    setStop({
                      type: "message",
                      reason: `The response reached the stop sequence: ${
                        (event as IAnthropicMessageResultMessageDelta).delta
                          .stop_sequence
                      }`,
                      level: "subtext",
                    });
                    break;
                  case "tool_use":
                    setStop({
                      type: "tool_use",
                    });
                    break;
                  case "pause_turn":
                    setStop({
                      type: "message",
                      reason: "Claude AI paused its turn.",
                      level: "info",
                    }); // TODO: maybe retry?
                    break;
                  case "refusal":
                    setStop({
                      type: "message",
                      reason: "Claude AI refused to answer.",
                      level: "error",
                    });
                    break;
                  default:
                    setStop({
                      type: "message",
                      reason: `The response reached an unknown stop reason: ${event.delta.stop_reason}`,
                      level: "error",
                    });
                    break;
                }
              } else if (event.type === "content_block_start") {
                result(async (prev) => {
                  const index = event.index;
                  contentBlockMap[index] = prev.length;
                  if (event.content_block.type === "text") {
                    prev.push({
                      type: "text",
                      text: event.content_block.text,
                    });
                  } else if (event.content_block.type === "thinking") {
                    prev.push({
                      type: "thinking",
                      thinking: event.content_block.thinking,
                      signature: "",
                    });
                  } else if (event.content_block.type === "tool_use") {
                    prev.push({
                      type: "tool_use",
                      id: event.content_block.id,
                      name: event.content_block.name,
                      input: "",
                    });
                  }
                });
              } else if (event.type === "content_block_delta") {
                result(async (prev) => {
                  const index = event.index;
                  const actualIndex = contentBlockMap[index];
                  if (event.delta.type === "text_delta") {
                    (prev[actualIndex] as IMessageResultText).text +=
                      event.delta.text;
                  } else if (event.delta.type === "thinking_delta") {
                    (prev[actualIndex] as IMessageResultThinking).thinking +=
                      event.delta.thinking;
                  } else if (event.delta.type === "signature_delta") {
                    (prev[actualIndex] as IMessageResultThinking).signature =
                      event.delta.signature;
                  } else if (event.delta.type === "input_json_delta") {
                    (prev[actualIndex] as IMessageResultToolUse).input +=
                      event.delta.partial_json;
                  }
                });
              } else if (event.type === "content_block_stop") {
                // No action needed for content_block_stop events
              } else {
                // Unexpected event type
                throw new AnthropicUnexpectedMessageTypeError("unknown");
              }
            } catch (e) {
              console.error("JSON parse error:", e);
            } finally {
              console.groupEnd();
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getDefaultModelConfig(modelId: string): IAnthropicModelConfig {
    const modelInfo = this.getModelInfo(modelId);
    if (!modelInfo) {
      throw new ExpectedError(404, "model_not_found", "Model not found");
    }

    return {
      temperature: 1,
      maxOutput: Math.floor(modelInfo.maxOutput / 4 * 3),
      stopSequences: [],
      extendedThinking: modelInfo.extendedThinking,
      thinkingBudget: Math.floor(modelInfo.maxOutput / 4),
    };
  }

  protected getModelConfig(modelId: string): IAnthropicModelConfig {
    const configString = localStorage.getItem(
      PER_MODEL_CONFIG_KEY("anthropic", modelId)
    );
    if (!configString) {
      return this.getDefaultModelConfig(modelId);
    }
    try {
      return {
        ...this.getDefaultModelConfig(modelId),
        ...(JSON.parse(configString) as IAnthropicModelConfig),
      };
    } catch (e) {
      console.error("JSON parse error:", e);
      return this.getDefaultModelConfig(modelId);
    }
  }

  getModelInfo(modelId: string) {
    return AnthropicModelRegistry.find((m) => m.id === modelId);
  }

  getModelContextWindow(modelId: string): number | undefined {
    return this.getModelInfo(modelId)?.contextWindow;
  }
}
