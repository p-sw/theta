import {
  API_KEY,
  SELECTED_MODEL,
  STORAGE_CHANGE_EVENT,
  TOOL_PROVIDER_AVAILABILITY_KEY,
  TOOL_PROVIDER_CONFIG_KEY,
  TOOL_PROVIDER_MODEL_KEY,
  TOOL_WHITELISTED_KEY,
  type IApiKey,
  type ISelectedModel,
  type IToolProviderModel,
} from "@/lib/const";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenAIProvider } from "../providers/openai";
import type {
  API,
  IMessageRequest,
  IMessageResult,
  IToolProvider,
  IToolProviderClass,
  SessionTurns,
  SessionTurnsResponse,
  SessionTurnsTool,
  SessionTurnsToolInProgress,
  ToolProviderBase,
} from "../shared";
import { localStorage } from "@/lib/storage";
import { hyperidInstance, sleep, dispatchEvent } from "@/lib/utils";
import { ToolRegistryError } from "./tool-agents/errors";

export class ToolAgent {
  toolProviderId: string;
  toolProviderDisplayName: string;

  aiProvider: API<unknown, unknown> | null = null;
  selectedModel: string | null = null;

  toolProviderClass: IToolProviderClass<Record<string, unknown>>;
  toolProviderInstance:
    | (ToolProviderBase & IToolProvider<Record<string, unknown>>)
    | null = null;

  constructor(toolProviderClass: IToolProviderClass<Record<string, unknown>>) {
    this.toolProviderClass = toolProviderClass;
    this.toolProviderId = toolProviderClass.id;
    this.toolProviderDisplayName = toolProviderClass.displayName;
    this.initProvider();
    window.addEventListener(
      STORAGE_CHANGE_EVENT(SELECTED_MODEL),
      this.initProvider
    );
    window.addEventListener(STORAGE_CHANGE_EVENT(API_KEY), this.initProvider);
    window.addEventListener(
      TOOL_PROVIDER_CONFIG_KEY(this.toolProviderId),
      this.initProvider
    );
  }

  private async initProvider() {
    const onFail = (message?: string) => {
      if (message)
        console.error(
          `${message} while initializing tool agent (${this.toolProviderId})`
        );
      this.toolProviderInstance = null;
      dispatchEvent(TOOL_PROVIDER_AVAILABILITY_KEY, {});
    };
    const provider = new this.toolProviderClass();

    // 1. initialize AI provider

    let apiKeyMap: IApiKey;
    const defaultSelectedModel: ISelectedModel | [] = JSON.parse(
      localStorage.getItem(SELECTED_MODEL) ?? "[]"
    );
    const toolProviderModelMap: IToolProviderModel = JSON.parse(
      localStorage.getItem(TOOL_PROVIDER_MODEL_KEY) ?? "{}"
    );
    try {
      apiKeyMap = JSON.parse(localStorage.getItem(API_KEY) ?? "{}");
    } catch (e) {
      onFail("Failed to get api key map");
      return;
    }

    const selectedModel: ISelectedModel | [] =
      toolProviderModelMap[this.toolProviderId] ?? defaultSelectedModel;
    if (!selectedModel || selectedModel.length === 0) {
      onFail("Failed to get model selected");
      return;
    }

    const apiKey = apiKeyMap[selectedModel[0]];
    if (apiKey === null) {
      onFail(`No API key found for selected provider (${selectedModel[0]})`);
      return;
    }

    this.selectedModel = selectedModel[1];
    switch (selectedModel[0]) {
      case "openai":
        this.aiProvider = new OpenAIProvider(apiKey);
        break;
      case "anthropic":
        this.aiProvider = new AnthropicProvider(apiKey);
        break;
    }

    // 2. initialize tool provider instance
    const toolProviderConfig = localStorage.getItem(
      TOOL_PROVIDER_CONFIG_KEY(this.toolProviderId)
    );
    if (!toolProviderConfig) {
      onFail();
      return;
    }
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = JSON.parse(toolProviderConfig);
    } catch {
      onFail("Failed to parse tool provider config");
      return;
    }
    // back up with default config
    parsedConfig = {
      ...provider.getDefaultConfig(),
      ...parsedConfig,
    };
    // try setup
    try {
      provider.setup(parsedConfig);
      this.toolProviderInstance = provider;
      dispatchEvent(TOOL_PROVIDER_AVAILABILITY_KEY, {});
    } catch (e) {
      if (e instanceof ToolRegistryError) {
        // failure of config validation - skip
      } else {
        throw new ToolRegistryError(
          `Unexpected error while setting up provider ${this.toolProviderId}: ${
            (e as Error).message
          }`
        );
      }
    }
  }

  /*
   * Outside:
   *
   * async function updateResult(resultMessage: IMessageResult[], updator: (message: IMessageResult[]) => Promise<unknown>) {
   *   await updator(resultMessage);
   *   session.updatedAt = Date.now();
   *   saveSession();
   * }
   */
  async message(
    sessionTurns: SessionTurns,
    saveSession: (throttle?: boolean) => void,
    refreshSession: () => Promise<SessionTurns>,
    updateResult: (
      resultMessage: IMessageResult[],
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) => Promise<void>,
    requestMessage: IMessageRequest[],
    onUsage: (delta: {
      inputTokensDelta?: number;
      outputTokensDelta?: number;
    }) => void,
    abortController: AbortController,
    onFinish: () => Promise<void>
  ) {
    if (this.aiProvider === null || this.selectedModel === null)
      throw new Error(
        `AI Provider of agent (${this.toolProviderId}) is not initialized.`
      );

    if (this.toolProviderInstance === null)
      throw new Error(
        `Tool provider of agent (${this.toolProviderId}) is not initialized.`
      );

    sessionTurns.push({
      type: "request",
      messageId: hyperidInstance(),
      message: requestMessage,
    });

    let resultMessage: IMessageResult[] = [];
    let resultTurn: SessionTurnsResponse = {
      type: "response" as const,
      messageId: hyperidInstance(),
      message: resultMessage,
    };
    sessionTurns.push(resultTurn);
    saveSession(false);

    async function _updateResult(
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) {
      await updateResult(resultMessage, updator);
    }

    while (true) {
      try {
        await this.aiProvider.message(
          sessionTurns.slice(0, -1),
          this.selectedModel,
          _updateResult,
          (stop) => {
            if (resultTurn.stop !== undefined) return;
            resultTurn.stop = stop;
            saveSession();
          },
          this.toolProviderInstance.getEnabledTools(),
          onUsage,
          undefined,
          abortController.signal
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          break;
        } else {
          throw e;
        }
      }

      // tool use handling (tool agent call)
      if (resultTurn.stop?.type === "tool_use") {
        const toolUses = resultTurn.message.filter(
          (message) => message.type === "tool_use"
        );
        // const toolUseResult: IMessageRequestToolResult[] = [];

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
          sessionTurns.push(toolTurn);
          console.debug("Adding tool to run: ", toolTurn);
          if (isWhitelisted) {
            console.debug(
              "Tool is whitelisted and will auto-execute:",
              toolUse.name
            );
          }
          saveSession();
        });

        while (true) {
          await sleep(500);
          // session = await getSessionFromStorage(); // refresh session
          sessionTurns = await refreshSession(); // do the same thing, sessionTurns is not updated so do that manually

          const freshedTools = Array.from(sessionTurns.entries()).filter(
            (turn) => turn[1].type === "tool"
          ) as [number, SessionTurnsTool][];

          // Execute tools that are granted but not done
          const shouldBeExecuteds = freshedTools.filter(
            (toolTurn) => toolTurn[1].granted && !toolTurn[1].done
          );
          await Promise.all(
            shouldBeExecuteds.filter(([turnIndex, toolTurn]) =>
              this.toolProviderInstance!.execute(
                toolTurn.toolName,
                JSON.parse(toolTurn.requestContent)
              )
                .then((toolResult) => {
                  sessionTurns[turnIndex] = {
                    ...toolTurn,
                    done: true,
                    isError: false,
                    responseContent: toolResult,
                  };
                  saveSession();
                })
                .catch((e) => {
                  sessionTurns[turnIndex] = {
                    ...toolTurn,
                    done: true,
                    isError: true,
                    responseContent:
                      (e as Error).message ??
                      "Unexpected error while executing tool",
                  };
                  saveSession();
                })
            )
          );

          // Check if all tools are done
          const waitingForGrants = freshedTools.filter(
            (toolTurn) => !toolTurn[1].granted && !toolTurn[1].done
          );
          if (shouldBeExecuteds.length === 0 && waitingForGrants.length === 0)
            break;
        }

        resultMessage = [];
        resultTurn = {
          type: "response" as const,
          messageId: hyperidInstance(),
          message: resultMessage,
        };
        sessionTurns.push(resultTurn);
        saveSession();
        continue;
      }

      break;
    }

    await onFinish();
  }
}
