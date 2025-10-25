import {
  API_KEY,
  type IApiKey,
  type ITheme,
  MODELS,
  SELECTED_MODEL,
  THEME,
} from "@/lib/const";
import { useStorage, useStorageKey } from "@/lib/utils";
import type { IModelInfo, IProvider, TemporarySession } from "@/sdk/shared";
import { ADVANCED_KEY, type IAdvancedSettings } from "@/lib/const";
import { useCallback, useContext } from "react";
import { sessionStorage } from "@/lib/storage";
import { PathContext } from "@/page/context/Path";

export function usePath() {
  const { path, setPath } = useContext(PathContext);
  return [path, setPath] as const;
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
    openai: null,
  });
}

export function useSelectedModel() {
  return useStorage<[IProvider, string] | []>(SELECTED_MODEL, []);
}

export function useAdvanced() {
  return useStorage<IAdvancedSettings>(
    ADVANCED_KEY,
    {
      showTokenCount: false,
      showToolDetails: true,
    }
  );
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
        continue;
      }
      if ((JSON.parse(sessionString) as TemporarySession).turns.length === 0) {
        sessionStorage.removeItem(sessionKey);
      }
    }
  }, []);
}
