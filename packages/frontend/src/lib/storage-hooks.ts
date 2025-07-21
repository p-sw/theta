import {
  API_KEY,
  MODELS,
  PATH,
  PATHS,
  SELECTED_MODEL,
  STORAGE_CHANGE_EVENT_ALL,
  THEME,
  type IApiKey,
  type ITheme,
} from "@/lib/const";
import { dispatchEvent, useStorage, useStorageKey } from "@/lib/utils";
import type { IModelInfo, IProvider } from "@/sdk/shared";
import type { TemporarySession } from "@/sdk/shared";
import { useCallback } from "react";

export function usePath() {
  return useStorage<string>(PATH, PATHS.CHAT, undefined, {
    temp: true,
  });
}

export function useTheme() {
  return useStorage<ITheme>(
    THEME,
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
}

export function useModels() {
  return useStorage<IModelInfo[]>(MODELS, []);
}

export function useApiKey() {
  return useStorage<IApiKey>(API_KEY, {
    anthropic: null,
  });
}

export function useSelectedModel() {
  return useStorage<[IProvider, string] | []>(SELECTED_MODEL, []);
}

export function useSessionKeys({
  sessionStorage,
}: {
  sessionStorage: boolean;
}) {
  const keys = useStorageKey({ sessionStorage });

  return keys.filter((key) => key.startsWith("session-"));
}

export function useSessionCleanup() {
  return useCallback(() => {
    const sessionsFromSessionStorage = Object.keys(sessionStorage).filter(
      (key) => key.startsWith("session-")
    );
    for (const sessionKey of sessionsFromSessionStorage) {
      const sessionString = localStorage.getItem(sessionKey);
      if (!sessionString || sessionString.length === 0) {
        sessionStorage.removeItem(sessionKey);
        dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
        continue;
      }
      if ((JSON.parse(sessionString) as TemporarySession).turns.length === 0) {
        sessionStorage.removeItem(sessionKey);
        dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
        continue;
      }
    }
  }, []);
}
