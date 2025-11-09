import {
  API_KEY,
  SESSION_STORAGE_KEY,
  TOOL_WHITELISTED_KEY,
  STORAGE_CHANGE_EVENT,
  MODELS,
  PER_MODEL_CONFIG_KEY,
  SYSTEM_PROMPTS_KEY,
  type IApiKey,
} from "@/lib/const";
import { hyperidInstance } from "@/lib/utils";
import { toolRegistry } from "@/sdk/tools";
import type {
  IMessageRequest,
  IMessageResult,
  IModelInfo,
  IProvider,
  IProviderInfo,
  SessionTurnsResponse,
  SessionTurnsToolInProgress,
  TemporarySession,
} from "@/sdk/shared";
import { localStorage, sessionStorage } from "@/lib/storage";
import { proxyfetch } from "@/lib/proxy";
import { streamText, tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { ModelMessage } from "ai";

export const providerRegistry: Record<IProvider, IProviderInfo> = {
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
  },
  openai: {
    id: "openai",
    displayName: "OpenAI",
  },
};

// Model registries
const AnthropicModelRegistry: {
  id: string;
  displayName: string;
  extendedThinking: boolean;
  contextWindow: number;
  maxOutput: number;
}[] = [
  {
    id: "claude-3-haiku-20240307",
    displayName: "Claude Haiku 3",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 4096,
  },
  {
    id: "claude-3-opus-20240229",
    displayName: "Claude Opus 3",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 4096,
  },
  {
    id: "claude-3-5-haiku-20241022",
    displayName: "Claude Haiku 3.5",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 8192,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    displayName: "Claude Sonnet 3.5",
    extendedThinking: false,
    contextWindow: 200000,
    maxOutput: 8192,
  },
  {
    id: "claude-3-7-sonnet-20250219",
    displayName: "Claude Sonnet 3.7",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 64000,
  },
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 64000,
  },
  {
    id: "claude-opus-4-20250514",
    displayName: "Claude Opus 4",
    extendedThinking: true,
    contextWindow: 200000,
    maxOutput: 32000,
  },
];

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

/**
 * Adapter function to convert standard fetch API to proxyfetch format.
 * This allows ai-sdk to use proxyfetch instead of window.fetch.
 */
function createProxyFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Extract URL from various input types
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }
    
    // Convert body to Record format for proxyfetch
    // proxyfetch expects body as Record<string, unknown> which gets sent as JSON
    let body: Record<string, unknown> | undefined;
    if (init?.body) {
      if (typeof init.body === "string") {
        // Try to parse as JSON - ai-sdk typically sends JSON strings
        try {
          body = JSON.parse(init.body);
        } catch {
          // If parsing fails, wrap it as a raw string value
          // This shouldn't happen with ai-sdk, but handle it gracefully
          body = { _raw: init.body } as unknown as Record<string, unknown>;
        }
      } else if (init.body instanceof FormData) {
        // Convert FormData to a plain object (proxyfetch expects JSON)
        const formDataObj: Record<string, unknown> = {};
        for (const [key, value] of init.body.entries()) {
          formDataObj[key] = value instanceof File ? value.name : value;
        }
        body = formDataObj;
      } else if (init.body instanceof Blob || init.body instanceof ArrayBuffer) {
        // Blob/ArrayBuffer not directly supported by proxyfetch
        // This shouldn't occur with ai-sdk API calls
        throw new Error("proxyfetch only supports JSON request bodies");
      } else {
        // Already an object or other type
        body = init.body as unknown as Record<string, unknown>;
      }
    }

    return proxyfetch(url, {
      method: init?.method || "GET",
      headers: init?.headers as HeadersInit,
      body,
      signal: init?.signal || undefined,
    });
  };
}

export class AISDK {
  private anthropicApiKey: string | null = null;
  private openaiApiKey: string | null = null;
  /** Holds the abort controller for the currently streaming request (if any) */
  public currentAbortController: AbortController | null = null;
  private proxyFetch: typeof fetch;

  constructor() {
    // Create proxy fetch adapter
    this.proxyFetch = createProxyFetch();
    
    // Initialise providers from the current content of localStorage.
    this.initProviders();

    // Re-initialise providers whenever the API key changes in storage.
    window.addEventListener(STORAGE_CHANGE_EVENT(API_KEY), () => {
      this.initProviders();
    });
  }

  /**
   * (Re)initialise provider instances based on the latest API key values.
   */
  private async initProviders() {
    const apiKey: IApiKey = JSON.parse(localStorage.getItem(API_KEY) ?? "{}");

    this.anthropicApiKey = apiKey.anthropic ?? null;
    this.openaiApiKey = apiKey.openai ?? null;

    // Refresh models list after provider updates
    await this.refreshModels();
  }

  private async refreshModels() {
    try {
      const fetchedModels = await this.getAvailableModels();

      // Parse previously stored models (if any)
      let prevModels: IModelInfo[] = [];
      const prevRaw = localStorage.getItem(MODELS);
      if (prevRaw) {
        try {
          prevModels = JSON.parse(prevRaw) as IModelInfo[];
        } catch {
          // Malformed json – ignore and treat as empty
        }
      }

      // Merge: keep existing flags (e.g. disabled) for models that still exist
      const mergedModels: IModelInfo[] = fetchedModels.map((model) => {
        const prev = prevModels.find(
          (m) => m.id === model.id && m.provider === model.provider
        );
        return prev ?? model;
      });

      const next = JSON.stringify(mergedModels);

      if (prevRaw !== next) {
        localStorage.setItem(MODELS, next);
      }
    } catch (err) {
      console.error("Failed to refresh models list", err);
    }
  }

  async abortCurrent() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  async getAvailableModels(): Promise<IModelInfo[]> {
    const anthropicModels = AnthropicModelRegistry.map((model) => ({
      provider: "anthropic" as IProvider,
      id: model.id,
      displayName: model.displayName,
      disabled: false,
    }));

    const openaiModels = OpenAIModelRegistry.map((model) => ({
      provider: "openai" as IProvider,
      id: model.id,
      displayName: model.displayName,
      disabled: false,
    }));

    return [...anthropicModels, ...openaiModels];
  }

  private convertToolsToAISDK(tools: ReturnType<typeof toolRegistry.getEnabledTools>) {
    return tools.map((toolMeta) => {
      return tool({
        description: toolMeta.description,
        inputSchema: toolMeta.schema,
        execute: async (params: unknown) => {
          // Validate parameters
          const validatedParams = await toolMeta.schema.parseAsync(params);
          // Execute via tool registry
          return await toolRegistry.execute(toolMeta.id, validatedParams);
        },
      } as unknown as ReturnType<typeof tool>);
    });
  }

  private convertSessionToAISDKMessages(session: import("@/sdk/shared").SessionTurns): ModelMessage[] {
    const messages: ModelMessage[] = [];

    for (const turn of session) {
      if (turn.type === "request") {
        const userContent: string[] = [];
        for (const turnPartial of turn.message) {
          if (turnPartial.type === "text") {
            userContent.push(turnPartial.text);
          }
        }
        if (userContent.length > 0) {
          messages.push({
            role: "user",
            content: userContent.join("\n"),
          });
        }
      } else if (turn.type === "response") {
        const assistantParts: Array<{ type: string; text?: string; toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }> }> = [];
        const toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }> = [];
        
        for (const turnPartial of turn.message) {
          if (turnPartial.type === "text") {
            assistantParts.push({ type: "text", text: turnPartial.text });
          } else if (turnPartial.type === "tool_use") {
            try {
              toolCalls.push({
                toolCallId: turnPartial.id,
                toolName: turnPartial.name,
                args: JSON.parse(turnPartial.input || "{}"),
              });
            } catch {
              toolCalls.push({
                toolCallId: turnPartial.id,
                toolName: turnPartial.name,
                args: {},
              });
            }
          }
        }
        
        if (assistantParts.length > 0 || toolCalls.length > 0) {
          // For assistant messages, ai-sdk handles tool calls separately
          // We'll add the text content, and tool calls will be added as separate messages
          if (assistantParts.length > 0) {
            messages.push({
              role: "assistant",
              content: assistantParts.map(p => p.text || "").join("\n"),
            });
          }
          // Note: Tool calls from previous turns are already handled as tool results
        }
      } else if (turn.type === "tool" && turn.done) {
        // Tool results are handled as tool results in ai-sdk
        messages.push({
          role: "tool",
          toolCallId: turn.useId,
          content: turn.responseContent,
        } as unknown as ModelMessage);
      }
    }

    return messages;
  }


  async message(
    sessionId: string,
    isPermanentSession: boolean,
    provider: IProvider,
    model: string,
    requestMessage: IMessageRequest[]
  ): Promise<void> {
    const storage = isPermanentSession ? localStorage : sessionStorage;
    const session = JSON.parse(
      storage.getItem(SESSION_STORAGE_KEY(sessionId)) ?? "{}"
    ) as TemporarySession;

    // Saving the whole session (which grows over time) to storage on *every*
    // streamed token is expensive – the JSON.stringify call allocates a big
    // string and the subsequent custom Storage event causes a React render.
    // When a long answer is streamed these calls can fire hundreds of times
    // per second which results in visible lag / stuttering.

    // To keep the UI responsive we rate-limit the writes so we only hit
    // localStorage at most once every 150 ms.  The very last call is always
    // flushed to make sure nothing is lost.

    let lastSave = 0;
    let pendingFlush: number | null = null;

    function flushSession() {
      if (pendingFlush) {
        cancelAnimationFrame(pendingFlush);
      }
      pendingFlush = null;
      lastSave = performance.now();
      storage.setItem(SESSION_STORAGE_KEY(sessionId), JSON.stringify(session));
    }

    function saveSession(throttle = true) {
      if (!throttle) {
        flushSession();
        return;
      }

      const now = performance.now();
      // If the last save was long enough ago – save immediately.
      if (now - lastSave > 150) {
        flushSession();
      } else if (pendingFlush === null) {
        // Otherwise schedule a write on the next animation frame so we never
        // block the main thread for too long during rapid streaming.
        pendingFlush = requestAnimationFrame(flushSession);
      }
    }

    session.turns.push({
      type: "request",
      messageId: hyperidInstance(),
      message: requestMessage,
    });
    saveSession(false /* no throttle – first write */);

    const resultMessage: IMessageResult[] = [];
    const resultTurn: SessionTurnsResponse = {
      type: "response" as const,
      messageId: hyperidInstance(),
      message: resultMessage,
    };
    session.turns.push(resultTurn);
    saveSession(false /* no throttle – second write */);

    // Setup abort controller for this message stream
    const abortController = new AbortController();
    // track the currently running stream so it can be aborted later
    this.currentAbortController = abortController;

    async function updateSession(
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) {
      await updator(resultMessage);
      session.updatedAt = Date.now();
      // This path is hit by *every* streamed chunk – throttle it.
      saveSession();
    }

    try {
      // Get API key
      const apiKey = provider === "anthropic" ? this.anthropicApiKey : this.openaiApiKey;
      if (!apiKey) {
        throw new Error(`Provider ${provider} API key not configured`);
      }

      // Create model client with proxy fetch
      const modelClient =
        provider === "anthropic"
          ? createAnthropic({ apiKey, fetch: this.proxyFetch })
          : createOpenAI({ apiKey, fetch: this.proxyFetch });

      // Get model config
      const modelConfig = this.getModelConfig(provider, model);

      // Get system prompts
      const systemPrompts: string[] = [
        "Today's datetime is " + new Date().toISOString(),
      ];
      try {
        const systemPromptsString = localStorage.getItem(SYSTEM_PROMPTS_KEY);
        if (systemPromptsString) {
          const systemPromptsData = JSON.parse(systemPromptsString);
          if (
            systemPromptsData.systemPrompts &&
            Array.isArray(systemPromptsData.systemPrompts)
          ) {
            systemPrompts.push(...systemPromptsData.systemPrompts.filter((p: string) => p.trim()));
          }
        }
      } catch (e) {
        console.error("Error parsing system prompts:", e);
      }

      // Convert session to ai-sdk messages
      const messages = this.convertSessionToAISDKMessages(session.turns.slice(0, -1));

      // Get enabled tools
      const enabledTools = toolRegistry.getEnabledTools();
      const aiTools = this.convertToolsToAISDK(enabledTools);

      // Create tools map
      const toolsMap = aiTools.length > 0 
        ? Object.fromEntries(aiTools.map((t, i) => [enabledTools[i].id, t]))
        : undefined;

      // Stream text using ai-sdk
      const result = streamText({
        model: modelClient(model),
        system: systemPrompts.join("\n"),
        messages,
        tools: toolsMap,
        abortSignal: abortController.signal,
        temperature: modelConfig.temperature as number,
      });

      // Handle streaming
      let hasStarted = false;

      for await (const chunk of result.textStream) {
        if (!hasStarted) {
          hasStarted = true;
          await updateSession(async (prev) => prev.push({ type: "start" }));
        }
        await updateSession(async (prev) => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.type === "text") {
            lastItem.text += chunk;
          } else {
            prev.push({ type: "text", text: chunk });
          }
        });
      }

      // Handle tool calls
      const toolCalls = await result.toolCalls;
      for (const toolCall of toolCalls) {
        await updateSession(async (prev) => {
          prev.push({
            type: "tool_use",
            id: toolCall.toolCallId,
            name: toolCall.toolName,
            input: JSON.stringify(toolCall.input),
          });
        });
      }

      // Handle finish
      const finishReason = await result.finishReason;
      if (finishReason === "tool-calls") {
        resultTurn.stop = { type: "tool_use" };
      } else if (finishReason === "stop") {
        resultTurn.stop = { type: "log", message: "Assistant has finished its turn." };
      } else if (finishReason === "length") {
        resultTurn.stop = {
          type: "message",
          reason: "The response reached the maximum number of tokens.",
          level: "error",
        };
      } else if (finishReason === "error") {
        resultTurn.stop = {
          type: "message",
          reason: "An error occurred during generation.",
          level: "error",
        };
      }
      await updateSession(async (prev) => prev.push({ type: "end" }));
      saveSession();

      // Track usage
      const usage = await result.usage;
      if (!session.tokenUsage) {
        session.tokenUsage = { input: 0, output: 0 };
      }
      session.tokenUsage.input += (usage as { promptTokens?: number }).promptTokens ?? usage.inputTokens ?? 0;
      session.tokenUsage.output += (usage as { completionTokens?: number }).completionTokens ?? usage.outputTokens ?? 0;
      saveSession();

    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // Aborted by user
      } else {
        throw e;
      }
    }

    // tool use handling
    if (resultTurn.stop?.type === "tool_use") {
      const toolUses = resultTurn.message.filter(
        (message) => message.type === "tool_use"
      );

      // Check whitelisted tools
      let whitelistedTools: string[] = [];
      try {
        const whitelistedData = localStorage.getItem(TOOL_WHITELISTED_KEY);
        if (whitelistedData) {
          whitelistedTools = JSON.parse(whitelistedData) as string[];
        }
      } catch (e) {
        console.error("Error parsing whitelisted tools:", e);
      }

      toolUses.forEach((toolUse) => {
        const isWhitelisted = whitelistedTools.includes(toolUse.name);
        const toolTurn: SessionTurnsToolInProgress = {
          type: "tool",
          useId: toolUse.id,
          toolName: toolUse.name,
          granted: isWhitelisted, // Auto-grant if whitelisted
          requestContent: toolUse.input !== "" ? toolUse.input : "{}",
          done: false,
        };
        session.turns.push(toolTurn);
        console.debug("Adding tool to run: ", toolTurn);
        if (isWhitelisted) {
          console.debug(
            "Tool is whitelisted and will auto-execute:",
            toolUse.name
          );
        }
        saveSession();
      });
    }

    // Clear the abort controller reference when streaming is finished or aborted
    if (this.currentAbortController === abortController) {
      this.currentAbortController = null;
    }

    // Make sure any pending throttled save is flushed when the stream ends so
    // we don't lose the tail of the response.
    flushSession();
  }

  getDefaultModelConfig(provider: IProvider, modelId: string) {
    if (provider === "anthropic") {
      const modelInfo = AnthropicModelRegistry.find((m) => m.id === modelId);
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`);
      }
      return {
        temperature: 1,
        maxOutput: 2048,
        stopSequences: [] as string[],
        extendedThinking: modelInfo.extendedThinking,
        thinkingBudget: 1024,
      };
    } else {
      const modelInfo = OpenAIModelRegistry.find((m) => m.id === modelId);
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`);
      }
      return {
        temperature: 1,
        maxOutput: 16384,
        reasoning: modelInfo.reasoning,
        reasoningEffort: "medium" as const,
      };
    }
  }

  private getModelConfig(provider: IProvider, modelId: string) {
    const configString = localStorage.getItem(PER_MODEL_CONFIG_KEY(provider, modelId));
    if (!configString) {
      return this.getDefaultModelConfig(provider, modelId);
    }
    try {
      return {
        ...this.getDefaultModelConfig(provider, modelId),
        ...(JSON.parse(configString) as Record<string, unknown>),
      };
    } catch (e) {
      console.error("JSON parse error:", e);
      return this.getDefaultModelConfig(provider, modelId);
    }
  }

  getModelConfigSchema(provider: IProvider, modelId: string): [Record<string, import("@/sdk/shared").IConfigSchema>, z.ZodSchema] {
    // This will be implemented based on the old provider implementations
    // For now, return a basic schema
    if (provider === "anthropic") {
      const modelInfo = AnthropicModelRegistry.find((m) => m.id === modelId);
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`);
      }
      return [
        {
          temperature: {
            displayName: "Temperature",
            description: "The temperature of the model.",
            type: "number" as const,
            min: 0,
            max: 1,
            step: 0.01,
            disabled: { $ref: "extendedThinking" },
          },
          maxOutput: {
            displayName: "Max Output",
            description: "The maximum number of tokens to output.",
            type: "number" as const,
            min: 1024,
            max: modelInfo.maxOutput,
            step: 1,
          },
          stopSequences: {
            displayName: "Stop Sequences",
            description: "The stop sequences of the model.",
            type: "array" as const,
            items: {
              type: "string" as const,
            },
          },
          extendedThinking: {
            displayName: "Extended Thinking",
            description: "Whether to use thinking.",
            type: "boolean" as const,
            disabled: !modelInfo.extendedThinking,
          },
          thinkingBudget: {
            displayName: "Thinking Budget",
            description:
              "The token budget for extended thinking. Should be less than maxOutput.",
            type: "number" as const,
            min: 1024,
            max: { $ref: "maxOutput" },
            step: 1,
            disabled: { $ref: "extendedThinking", not: true },
          },
        },
        z.object({
          temperature: z.number().min(0).max(1),
          maxOutput: z.number().min(1024).max(modelInfo.maxOutput),
          stopSequences: z.array(z.string()),
          extendedThinking: z.boolean(),
          thinkingBudget: z.number().min(512),
        }).refine(
          (data) =>
            data.extendedThinking ? data.thinkingBudget < data.maxOutput : true,
          {
            message: "Thinking budget must be less than maxOutput.",
            path: ["thinkingBudget"],
          }
        ),
      ];
    } else {
      const modelInfo = OpenAIModelRegistry.find((m) => m.id === modelId);
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`);
      }
      return [
        {
          temperature: {
            displayName: "Temperature",
            description: "The temperature of the model.",
            type: "number" as const,
            min: 0,
            max: 2,
            step: 0.1,
            disabled: { $ref: "reasoning" },
          },
          maxOutput: {
            displayName: "Max Output",
            description: "The maximum number of tokens to output.",
            type: "number" as const,
            min: 2048,
            max: modelInfo.maxOutput,
            step: 1,
          },
          reasoning: {
            displayName: "Reasoning",
            description: "Whether to use reasoning (thinking).",
            type: "boolean" as const,
            disabled: !modelInfo.reasoning,
          },
          reasoningEffort: {
            displayName: "Reasoning Effort",
            description: "The effort of the reasoning.",
            type: "enum" as const,
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
  }

  getModelContextWindow(provider: IProvider, modelId: string): number | undefined {
    if (provider === "anthropic") {
      return AnthropicModelRegistry.find((m) => m.id === modelId)?.contextWindow;
    } else {
      return OpenAIModelRegistry.find((m) => m.id === modelId)?.contextWindow;
    }
  }
}

export const AiSdk = new AISDK();
