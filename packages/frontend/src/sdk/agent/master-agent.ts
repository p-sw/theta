import {
  API_KEY,
  SELECTED_MODEL,
  STORAGE_CHANGE_EVENT,
  type IApiKey,
  type ISelectedModel,
} from "@/lib/const";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenAIProvider } from "../providers/openai";
import type {
  API,
  IMessageRequest,
  IMessageResult,
  SessionTurns,
  SessionTurnsResponse,
  SessionTurnsTool,
  SessionTurnsToolInProgress,
} from "../shared";
import { localStorage } from "@/lib/storage";
import { hyperidInstance, sleep } from "@/lib/utils";
import { ToolAgentManager } from "./tool-agent-manager";

const toolAgentManager = new ToolAgentManager();

export class MasterAgent {
  aiProvider: API<unknown, unknown> | null = null;
  selectedModel: string | null = null;

  constructor() {
    this.initProvider();
    window.addEventListener(
      STORAGE_CHANGE_EVENT(SELECTED_MODEL),
      this.initProvider
    );
  }

  private async initProvider() {
    const selectedModel: ISelectedModel = JSON.parse(
      localStorage.getItem(SELECTED_MODEL) ?? "[]"
    );
    const apiKeyMap: IApiKey = JSON.parse(
      localStorage.getItem(API_KEY) ?? "{}"
    );

    const apiKey = apiKeyMap[selectedModel[0]];
    if (apiKey === null)
      throw new Error(
        `No API key found for selected provider (${selectedModel[0]})`
      );

    this.selectedModel = selectedModel[1];
    switch (selectedModel[0]) {
      case "openai":
        this.aiProvider = new OpenAIProvider(apiKey);
        break;
      case "anthropic":
        this.aiProvider = new AnthropicProvider(apiKey);
        break;
    }
  }

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
      throw new Error(`Provider of MasterAgent is not initialized.`);

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
          toolAgentManager.getEnabledTools(),
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

      if (resultTurn.stop?.type === "tool_use") {
        const toolUses = resultTurn.message.filter(
          (message) => message.type === "tool_use"
        );

        toolUses.forEach((toolUse) => {
          const toolTurn: SessionTurnsToolInProgress = {
            type: "tool",
            useId: toolUse.id,
            toolName: toolUse.name,
            granted: true, // always-run on MasterAgent calling other ToolAgent
            requestContent: toolUse.input !== "" ? toolUse.input : "{}",
            done: false,
          };
          sessionTurns.push(toolTurn);
          saveSession();
        });

        while (true) {
          await sleep(500);
          sessionTurns = await refreshSession();

          const freshedTools = Array.from(sessionTurns.entries()).filter(
            (turn) => turn[1].type === "tool"
          ) as [number, SessionTurnsTool][];

          const shouldBeExecuted = freshedTools.find(
            (toolTurn) => toolTurn[1].granted && !toolTurn[1].done
          );

          if (shouldBeExecuted) {
            const [turnIndex, toolTurn] = shouldBeExecuted;
            try {
              await toolAgentManager.execute(
                toolTurn.toolName,
                sessionTurns,
                saveSession,
                refreshSession,
                updateResult,
                requestMessage,
                onUsage,
                abortController,
                onFinish
              );
              sessionTurns[turnIndex] = {
                ...toolTurn,
                done: true,
                isError: false,
                responseContent: "Tool execution finished.",
              };
              saveSession();
            } catch (e) {
              sessionTurns[turnIndex] = {
                ...toolTurn,
                done: true,
                isError: true,
                responseContent:
                  (e as Error).message ??
                  "Unexpected error while executing tool",
              };
              saveSession();
            }
          }

          const waitingForGrants = freshedTools.some(
            (toolTurn) => !toolTurn[1].granted && !toolTurn[1].done
          );

          if (!shouldBeExecuted && !waitingForGrants) break;
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
