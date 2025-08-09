import { PER_MODEL_CONFIG_KEY, SYSTEM_PROMPTS_KEY } from "@/lib/const";
import { proxyfetch, ServerSideHttpError } from "@/lib/proxy";
import type {
  IOpenAIFunctionToolCall,
  IOpenAIFunctionToolCallOutput,
  IOpenAIInput,
  IOpenAIInputMessage,
  IOpenAIModelConfig,
  IOpenAIOutputMessage,
  IOpenAIReasoning,
  IOpenAIToolSchema,
} from "@/sdk/providers/openai.types";
import type {
  IMessageResultThinking,
  IConfigSchema,
  IModelInfo,
  SessionTurns,
  IToolMetaJson,
  IMessageResultToolUse,
  IMessageRequest,
} from "@/sdk/shared";
import {
  API,
  ExpectedError,
  SessionTranslationError,
  type IMessageResult,
  type IMessageResultText,
  type SessionTurnsResponse,
} from "@/sdk/shared";
import z from "zod";

const OpenAIModelRegistry: {
  id: string;
  displayName: string;
  reasoning: boolean;
  contextWindow: number;
  maxOutput: number;
  streaming: boolean;
}[] = [
  {
    id: "o1",
    displayName: "o1",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: true,
  },
  {
    id: "o1-pro",
    displayName: "o1-pro",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: false,
  },
  {
    id: "o3",
    displayName: "o3",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: true,
  },
  {
    id: "o3-mini",
    displayName: "o3-mini",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: true,
  },
  {
    id: "o3-pro",
    displayName: "o3-pro",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: false,
  },
  {
    id: "o4-mini",
    displayName: "o4-mini",
    reasoning: true,
    contextWindow: 200000,
    maxOutput: 100000,
    streaming: true,
  },
  {
    id: "gpt-4.1",
    displayName: "GPT-4.1",
    reasoning: false,
    contextWindow: 1047576,
    maxOutput: 32768,
    streaming: true,
  },
  {
    id: "gpt-4.1-mini",
    displayName: "GPT-4.1 mini",
    reasoning: false,
    contextWindow: 1047576,
    maxOutput: 32768,
    streaming: true,
  },
  {
    id: "gpt-4.1-nano",
    displayName: "GPT-4.1 nano",
    reasoning: false,
    contextWindow: 1047576,
    maxOutput: 32768,
    streaming: true,
  },
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    reasoning: false,
    contextWindow: 128000,
    maxOutput: 16384,
    streaming: true,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    reasoning: false,
    contextWindow: 128000,
    maxOutput: 16384,
    streaming: true,
  },
  {
    id: "gpt-5",
    displayName: "GPT-5",
    reasoning: true,
    contextWindow: 400000,
    maxOutput: 128000,
    streaming: true,
  },
  {
    id: "gpt-5-mini",
    displayName: "GPT-5 mini",
    reasoning: true,
    contextWindow: 400000,
    maxOutput: 128000,
    streaming: true,
  },
  {
    id: "gpt-5-nano",
    displayName: "GPT-5 nano",
    reasoning: true,
    contextWindow: 400000,
    maxOutput: 128000,
    streaming: true,
  },
];

export class OpenAIUnexpectedMessageTypeError extends Error {
  readonly type: string;

  constructor(type: string) {
    super(`[OpenAI] Unexpected message type: ${type}`);
    this.name = "OpenAIUnexpectedMessageTypeError";
    this.type = type;
  }
}

export class OpenAIProvider extends API<IOpenAIInput, IOpenAIToolSchema> {
  protected readonly API_BASE_URL = "https://api.openai.com/v1";

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
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      method,
    };
  }

  protected async ensureSuccess(response: Response): Promise<void> {
    if (!response.ok) {
      // only check provider-side error
      try {
        const errorBody = (await response.json()) as {
          error: {
            message: string;
            type: string;
            param: string | null;
            code: string | null;
          };
        };
        throw new ExpectedError(
          response.status,
          errorBody.error.code ?? errorBody.error.type,
          errorBody.error.message
        );
      } catch {
        throw new ServerSideHttpError(response.status, response.statusText);
      }
    }
  }

  protected translateSession(session: SessionTurns): IOpenAIInput[] {
    const messages: IOpenAIInput[] = [];

    for (const turn of session) {
      if (turn.type === "tool") {
        if (!turn.done)
          throw new SessionTranslationError(
            `Tool is not done: ${turn.useId} ${turn.toolName}`
          );
        messages.push({
          type: "function_call_output",
          call_id: turn.useId,
          output: turn.responseContent,
        });
      }
      if (turn.type === "request") {
        const message: IOpenAIInputMessage = {
          type: "message",
          role: "user",
          content: [],
        };
        const toolResults: IOpenAIFunctionToolCallOutput[] = [];
        for (const turnPartial of turn.message) {
          switch (turnPartial.type) {
            case "text":
              message.content.push({
                type: "input_text",
                text: turnPartial.text,
              });
              break;
            default:
              console.warn(
                "[OpenAI] Unexpected message type while translating session:",
                turnPartial
              );
          }
        }

        if (message.content.length > 0) messages.push(message);
        if (toolResults.length > 0) messages.push(...toolResults);
      }
      if (turn.type === "response") {
        const message: IOpenAIOutputMessage[] = [];
        const reasoning: Record<string, IOpenAIReasoning> = {};
        const toolUses: IOpenAIFunctionToolCall[] = [];

        for (const turnPartial of turn.message) {
          switch (turnPartial.type) {
            case "start":
            case "end":
              break;
            case "text":
              if (!turnPartial.openai_id)
                throw new SessionTranslationError(
                  `Response Message ID is missing in ${JSON.stringify(
                    turnPartial
                  )}`
                );
              message.push({
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: turnPartial.text,
                    annotations: [],
                  },
                ],
                status: "completed",
                id: turnPartial.openai_id, // msg_xxxx
              });
              break;
            case "thinking":
              if (!turnPartial.openai_id) {
                throw new SessionTranslationError(
                  `Thinking ID is missing in ${JSON.stringify(turnPartial)}`
                );
              }

              if (!(turnPartial.openai_id in reasoning)) {
                reasoning[turnPartial.openai_id] = {
                  type: "reasoning",
                  summary: [
                    { type: "summary_text", text: turnPartial.thinking },
                  ],
                  id: turnPartial.openai_id,
                };
              } else {
                reasoning[turnPartial.openai_id].summary.push({
                  type: "summary_text",
                  text: turnPartial.thinking,
                });
              }
              break;
            case "tool_use":
              toolUses.push({
                type: "function_call",
                name: turnPartial.name,
                call_id: turnPartial.id,
                arguments: turnPartial.input,
                id: turnPartial.openai_id,
              });
              break;
            case "refusal":
              if (!turnPartial.openai_id) {
                throw new SessionTranslationError(
                  `Refusal ID is missing in ${JSON.stringify(turnPartial)}`
                );
              }
              message.push({
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "refusal",
                    refusal: turnPartial.refusal,
                  },
                ],
                status: "completed",
                id: turnPartial.openai_id,
              });
              break;
            default:
              console.warn(
                "[OpenAI] Unexpected message type while translating session:",
                turnPartial
              );
          }
        }
        if (Object.keys(reasoning).length > 0)
          messages.push(...Object.values(reasoning));
        if (message.length > 0) messages.push(...message);
        if (toolUses.length > 0) messages.push(...toolUses);
      }
    }

    return messages;
  }

  protected translateToolSchema(schema: IToolMetaJson[]): IOpenAIToolSchema[] {
    return schema.map((tool) => ({
      type: "function",
      name: tool.id,
      strict: false,
      parameters: tool.jsonSchema,
      description: tool.description,
    }));
  }

  async getModels(): Promise<IModelInfo[]> {
    return OpenAIModelRegistry.map((model) => ({
      provider: "openai",
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
    signal?: AbortSignal
  ): Promise<void> {
    const modelInfo = this.getModelInfo(model)!;
    const messages = this.translateSession(session);
    const modelConfig = this.getModelConfig(model);

    // Get system prompts from localStorage
    const systemPrompts = [
      {
        type: "text" as const,
        text: "Today's datetime is " + new Date().toISOString(),
      },
    ];

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

    // merge system prompts into messages
    messages.splice(0, 0, {
      type: "message",
      role: "system",
      content: systemPrompts.map((prompt) => ({
        type: "input_text",
        text: prompt.text,
      })),
    });

    const response = await proxyfetch(this.API_BASE_URL + "/responses", {
      ...this.buildAPIRequest("POST"),
      body: {
        model,
        max_output_tokens: modelConfig.maxOutput,
        temperature: !modelConfig.reasoning ? modelConfig.temperature : 1,
        input: messages,
        stream: modelInfo.streaming,
        ...(modelConfig.reasoning
          ? {
              reasoning: {
                effort: modelConfig.reasoningEffort,
                summary: "auto",
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
    // Maintain indices across the entire stream
    const itemIdToTextIndex: Record<string, number> = {};
    const itemIdToRefusalIndex: Record<string, number> = {};
    const itemIdToToolIndex: Record<string, number> = {};
    const toolCallIndexByCallId: Record<string, number> = {};
    const reasoningIndexById: Record<string, number> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);

          try {
            const event = JSON.parse(data) as Record<string, unknown>;

            // OpenAI streaming errors come as { type: 'error', error: { message, type, code? } }
            if (
              typeof event === "object" &&
              event !== null &&
              (event as { type?: string }).type === "error"
            ) {
              const err = (
                event as { error?: { type?: string; message?: string } }
              ).error ?? { type: "unknown_error", message: "Unknown error" };
              throw new ExpectedError(
                response.status,
                String(err.type ?? "error"),
                `[OpenAI] ${String(err.type ?? "error")}: ${String(
                  err.message ?? "Streaming error"
                )}`
              );
            }

            const type = (event as { type?: string }).type ?? "";

            switch (type) {
              case "response.created": {
                await result(async (prev) => prev.push({ type: "start" }));
                break;
              }
              case "response.in_progress":
              case "response.queued": {
                // ignore
                break;
              }
              case "response.completed": {
                setStop({
                  type: "log",
                  message: "Assistant has finished its turn.",
                });
                await result(async (prev) => prev.push({ type: "end" }));
                break;
              }
              case "response.failed": {
                setStop({
                  type: "message",
                  reason: "The response failed to complete.",
                  level: "error",
                });
                await result(async (prev) => prev.push({ type: "end" }));
                break;
              }
              case "response.incomplete": {
                setStop({
                  type: "message",
                  reason: "The response was incomplete.",
                  level: "subtext",
                });
                await result(async (prev) => prev.push({ type: "end" }));
                break;
              }
              case "response.output_item.added": {
                const payload = event as {
                  item:
                    | IOpenAIOutputMessage
                    | IOpenAIFunctionToolCall
                    | IOpenAIReasoning;
                };
                const item = payload.item;
                if (item.type === "function_call") {
                  const callId = item.call_id;
                  const openaiId = item.id;
                  const name = item.name;
                  await result(async (prev) => {
                    toolCallIndexByCallId[callId] = prev.length;
                    // Some streams also include an item.id; if present map it
                    if (item.id) itemIdToToolIndex[item.id] = prev.length;
                    prev.push({
                      type: "tool_use",
                      id: callId,
                      name,
                      input: "",
                      openai_id: openaiId,
                    });
                  });
                } else if (item.type === "reasoning") {
                  const reasoningId = item.id;
                  await result(async (prev) => {
                    reasoningIndexById[reasoningId] = prev.length;
                    prev.push({
                      type: "thinking",
                      thinking: "",
                      signature: "",
                      openai_id: reasoningId,
                    });
                  });
                } else {
                  // message – parts will arrive via content_part events
                }
                break;
              }
              case "response.output_item.done": {
                // no-op
                break;
              }
              case "response.content_part.added": {
                const payload = event as {
                  item_id: string;
                  part: { type: string; text?: string; refusal?: string };
                };
                if (payload.part.type === "output_text") {
                  await result(async (prev) => {
                    const idx = itemIdToTextIndex[payload.item_id];
                    if (typeof idx === "number") {
                      (prev[idx] as IMessageResultText).text +=
                        payload.part.text ?? "";
                    } else {
                      itemIdToTextIndex[payload.item_id] = prev.length;
                      prev.push({
                        type: "text",
                        text: payload.part.text ?? "",
                        openai_id: payload.item_id,
                      });
                    }
                  });
                } else if (payload.part.type === "refusal") {
                  await result(async (prev) => {
                    const idx = itemIdToRefusalIndex[payload.item_id];
                    if (typeof idx === "number") {
                      (prev[idx] as { refusal: string }).refusal +=
                        payload.part.refusal ?? "";
                    } else {
                      itemIdToRefusalIndex[payload.item_id] = prev.length;
                      prev.push({
                        type: "refusal",
                        refusal: payload.part.refusal ?? "",
                        openai_id: payload.item_id,
                      });
                    }
                  });
                }
                break;
              }
              case "response.content_part.done": {
                // no-op
                break;
              }
              case "response.output_text.delta": {
                const payload = event as { item_id: string; delta?: string };
                const delta = payload.delta ?? "";
                await result(async (prev) => {
                  const idx = itemIdToTextIndex[payload.item_id];
                  if (typeof idx === "number") {
                    (prev[idx] as IMessageResultText).text += delta;
                  } else {
                    itemIdToTextIndex[payload.item_id] = prev.length;
                    prev.push({
                      type: "text",
                      text: delta,
                      openai_id: payload.item_id,
                    });
                  }
                });
                break;
              }
              case "response.output_text.done": {
                // no-op
                break;
              }
              case "response.refusal.delta": {
                const payload = event as { item_id: string; delta?: string };
                const delta = payload.delta ?? "";
                await result(async (prev) => {
                  const idx = itemIdToRefusalIndex[payload.item_id];
                  if (typeof idx === "number") {
                    (prev[idx] as { refusal: string }).refusal += delta;
                  } else {
                    itemIdToRefusalIndex[payload.item_id] = prev.length;
                    prev.push({
                      type: "refusal",
                      refusal: delta,
                      openai_id: payload.item_id,
                    });
                  }
                });
                break;
              }
              case "response.refusal.done": {
                // no-op
                break;
              }
              case "response.function_call_arguments.delta": {
                const payload = event as { item_id: string; delta?: string };
                const delta = payload.delta ?? "";
                await result(async (prev) => {
                  const toolIdxByItem = itemIdToToolIndex[payload.item_id];
                  if (typeof toolIdxByItem === "number") {
                    (prev[toolIdxByItem] as IMessageResultToolUse).input +=
                      delta;
                    return;
                  }
                  // If we don't have item mapping, try the last known tool call entry
                  const lastToolIndex = Object.values(
                    toolCallIndexByCallId
                  ).slice(-1)[0];
                  if (typeof lastToolIndex === "number") {
                    (prev[lastToolIndex] as IMessageResultToolUse).input +=
                      delta;
                  } else {
                    // create a placeholder tool block keyed by item id
                    itemIdToToolIndex[payload.item_id] = prev.length;
                    prev.push({
                      type: "tool_use",
                      id: payload.item_id,
                      name: "",
                      input: delta,
                    });
                  }
                });
                break;
              }
              case "response.function_call_arguments.done": {
                setStop({ type: "tool_use" });
                break;
              }
              case "response.reasoning_text.delta": {
                const payload = event as { item_id?: string; delta?: string };
                const id = payload.item_id ?? "default_reasoning";
                const delta = payload.delta ?? "";
                await result(async (prev) => {
                  const existing = reasoningIndexById[id];
                  if (typeof existing === "number") {
                    (prev[existing] as IMessageResultThinking).thinking +=
                      delta;
                  } else {
                    reasoningIndexById[id] = prev.length;
                    prev.push({
                      type: "thinking",
                      thinking: delta,
                      signature: "",
                      openai_id: id,
                    });
                  }
                });
                break;
              }
              case "response.reasoning_text.done": {
                // no-op
                break;
              }
              case "response.reasoning_summary_text.delta": {
                const payload = event as { item_id?: string; delta?: string };
                const id = payload.item_id ?? "default_reasoning";
                const delta = payload.delta ?? "";
                await result(async (prev) => {
                  const existing = reasoningIndexById[id];
                  if (typeof existing === "number") {
                    const thinking = prev[existing] as IMessageResultThinking;
                    thinking.thinking += delta;
                  } else {
                    reasoningIndexById[id] = prev.length;
                    prev.push({
                      type: "thinking",
                      thinking: delta,
                      signature: "",
                      openai_id: id,
                    });
                  }
                });
                break;
              }
              case "response.reasoning_summary_text.done": {
                // no-op
                break;
              }
              case "response.reasoning_summary_part.added": {
                const payload = event as {
                  item_id?: string;
                  part: { type: "summary_text"; text: string };
                };
                const id = payload.item_id ?? "default_reasoning";
                const delta = payload.part?.text ?? "";
                await result(async (prev) => {
                  const existing = reasoningIndexById[id];
                  if (typeof existing === "number") {
                    const thinking = prev[existing] as IMessageResultThinking;
                    thinking.thinking += "\n\n" + delta;
                  } else {
                    reasoningIndexById[id] = prev.length;
                    prev.push({
                      type: "thinking",
                      thinking: delta,
                      signature: "",
                      openai_id: id,
                    });
                  }
                });
                break;
              }
              case "response.reasoning_summary_part.done": {
                // no-op
                break;
              }
              default: {
                // Ignore heartbeats and unknown minor events
                // Known benign: response.updated, response.in_progress, response.canceled
                // For truly unknown, we can log for diagnostics.
                // console.debug("[OpenAI] Ignored event:", type, event);
                break;
              }
            }
          } catch (e) {
            console.error("[OpenAI] JSON parse/error handling:", e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getDefaultModelConfig(modelId: string): IOpenAIModelConfig {
    const modelInfo = this.getModelInfo(modelId);
    if (!modelInfo) {
      throw new ExpectedError(404, "model_not_found", "Model not found");
    }

    return {
      temperature: 1,
      maxOutput: 16384,
      reasoning: modelInfo.reasoning,
      reasoningEffort: "medium",
    };
  }

  protected getModelConfig(modelId: string): IOpenAIModelConfig {
    const configString = localStorage.getItem(
      PER_MODEL_CONFIG_KEY("openai", modelId)
    );
    if (!configString) {
      return this.getDefaultModelConfig(modelId);
    }
    try {
      return {
        ...this.getDefaultModelConfig(modelId),
        ...(JSON.parse(configString) as IOpenAIModelConfig),
      };
    } catch (e) {
      console.error("JSON parse error:", e);
      return this.getDefaultModelConfig(modelId);
    }
  }

  getModelConfigSchema(
    modelId: string
  ): [
    Record<keyof IOpenAIModelConfig, IConfigSchema>,
    z.ZodSchema<IOpenAIModelConfig>
  ] {
    const modelInfo = this.getModelInfo(modelId);
    if (!modelInfo) {
      throw new ExpectedError(404, "model_not_found", "Model not found");
    }

    return [
      {
        temperature: {
          displayName: "Temperature",
          description: "The temperature of the model.",
          type: "number",
          min: 0,
          max: 2,
          step: 0.1,
          disabled: { $ref: "reasoning" },
        },
        maxOutput: {
          displayName: "Max Output",
          description: "The maximum number of tokens to output.",
          type: "number",
          min: 2048,
          max: modelInfo.maxOutput,
          step: 1,
        },
        reasoning: {
          displayName: "Reasoning",
          description: "Whether to use reasoning (thinking).",
          type: "boolean",
          disabled: !modelInfo.reasoning,
        },
        reasoningEffort: {
          displayName: "Reasoning Effort",
          description: "The effort of the reasoning.",
          type: "enum",
          placeholder: "Select effort",
          items: [
            { name: "Minimal (fastest)", value: "minimal" },
            { name: "Low (cost-effective)", value: "low" },
            { name: "Medium (balanced)", value: "medium" },
            { name: "High (expensive)", value: "high" },
          ],
          disabled: { $ref: "reasoning", not: true },
        },
      },
      z.object({
        temperature: z.number().min(0).max(2),
        maxOutput: z.number().min(2048).max(modelInfo.maxOutput),
        reasoning: z.boolean(),
        reasoningEffort: z.enum(["minimal", "low", "medium", "high"]),
      }),
    ];
  }

  getModelInfo(modelId: string) {
    return OpenAIModelRegistry.find((m) => m.id === modelId);
  }
}
