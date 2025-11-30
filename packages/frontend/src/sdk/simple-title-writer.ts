import { API_KEY, type IApiKey } from "@/lib/const";
import { OpenAIProvider } from "./providers/openai";
import { hyperidInstance } from "@/lib/utils";
import type { IMessageResult, TemporarySession } from "./shared";
import { StorageWrapper, localStorage } from "@/lib/storage";

// openai GPT 5 nano (no thinking)
export async function simpleTitleWrite(
  sessionKey: string,
  storage: StorageWrapper
): Promise<string | null> {
  const apiKey: IApiKey = JSON.parse(localStorage.getItem(API_KEY) ?? "{}");
  if (!apiKey.openai) return null;

  const sessionString = storage.getItem(sessionKey);
  if (!sessionString) return null;
  const session = JSON.parse(sessionString) as TemporarySession;

  const firstRequest = session.turns.find(
    (value) => value.type === "request"
  );
  if (!firstRequest) return null;
  let firstMessage = "";
  for (const message of firstRequest.message.filter(
    (v) => v.type === "text"
  )) {
    firstMessage = firstMessage + message.text + "\n";
  }

  const resultMessage: IMessageResult[] = [];
  async function updateSession(
    updator: (message: IMessageResult[]) => Promise<unknown>
  ) {
    await updator(resultMessage);
  }

  const openai = new OpenAIProvider(apiKey.openai);
  await openai.message(
    [
      {
        type: "request",
        messageId: hyperidInstance(),
        message: [{ type: "text", text: firstMessage }],
      },
    ],
    "gpt-5-nano",
    updateSession,
    () => {},
    [],
    () => {},
    {
      reasoning: false,
      system:
        "You are a title writer who reads the conversation and write a suitable, 4 ~ 6 words long title for that conversation. The first message will given to you, and you should write a title for that. You should only respond with title and nothing else.",
    }
  );

  const textResult = resultMessage.find((r) => r.type === "text");
  if (!textResult) return null;
  return textResult.text;
}
