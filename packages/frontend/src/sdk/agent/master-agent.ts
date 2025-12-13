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
  SessionTurnsSubSession,
} from "../shared";
import { localStorage } from "@/lib/storage";
import { hyperidInstance } from "@/lib/utils";
import { ToolAgentManager, toolAgentSchema } from "./tool-agent-manager";
import z from "zod";

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
    window.addEventListener(STORAGE_CHANGE_EVENT(API_KEY), this.initProvider);
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

        await Promise.all(
          toolUses.map(async (toolUse) => {
            const subsession: SessionTurns = [];
            const toolTurn: SessionTurnsSubSession = {
              type: "subsession",
              useId: toolUse.id,
              toolName: toolUse.name,
              turns: subsession,
            };
            sessionTurns.push(toolTurn);
            saveSession();

            async function updateSubsession(
              resultMessage: IMessageResult[],
              updator: (message: IMessageResult[]) => Promise<unknown>
            ) {
              await updateResult(resultMessage, updator);
            }

            await toolAgentManager.execute(
              toolUse.name,
              subsession,
              saveSession,
              refreshSession,
              updateSubsession,
              [
                {
                  type: "text",
                  text: (
                    await z.parseAsync(toolAgentSchema, toolUse.input)
                  ).prompt,
                },
              ],
              () => {},
              abortController,
              onFinish
            );
          })
        );

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
