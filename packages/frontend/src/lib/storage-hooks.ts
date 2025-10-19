import {
  API_KEY,
  type IApiKey,
  type ITheme,
  MODELS,
  PATHS,
  SELECTED_MODEL,
  THEME,
} from "@/lib/const";
import { useStorage, useStorageKey } from "@/lib/utils";
import type { IModelInfo, IProvider, TemporarySession } from "@/sdk/shared";
import { useCallback, useEffect, useState } from "react";
import { sessionStorage } from "@/lib/storage";
import { DEVELOPER_MODE_KEY } from "@/lib/const";

export function usePath() {
  // Determine initial path from URL to avoid first-render mismatch
  const allowed = new Set<string>(Object.values(PATHS));
  const initialUrlPath = (() => {
    try {
      return window.location.pathname;
    } catch {
      return PATHS.CHAT;
    }
  })();
  const fallbackPath = allowed.has(initialUrlPath) ? initialUrlPath : PATHS.CHAT;

  // In-memory state for current path (no persistence)
  const [storedPath, setStoredPath] = useState<string>(fallbackPath);

  const setPath = useCallback(
    (next: string | ((prev: string) => string)) => {
      const nextPath =
        typeof next === "function" ? (next as (prev: string) => string)(storedPath) : next;
      if (nextPath === storedPath) return;
      if (!allowed.has(nextPath)) {
        console.warn("Trying to load unknown page, ignoring")
	return
      }
      setStoredPath(nextPath);
      try {
        window.history.pushState({ path: nextPath }, "", nextPath);
      } catch {
        // ignore history errors in non-browser environments
      }
    },
    [storedPath, setStoredPath]
  );

  // Initial DOM load: ensure state reflects current URL via setPath
  useEffect(() => {
    try {
      const urlPath = window.location.pathname;
      const targetPath = allowed.has(urlPath) ? urlPath : PATHS.CHAT;
      setPath(targetPath);
    } catch {
      // ignore history errors in non-browser environments
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update state when user navigates with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const urlPath = window.location.pathname;
      const targetPath = allowed.has(urlPath) ? urlPath : PATHS.CHAT;
      if (targetPath !== storedPath) {
        setStoredPath(targetPath);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [storedPath, setStoredPath]);

  return [storedPath, setPath] as const;
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

export function useDeveloperMode() {
  const [devObj, setDevObj] = useStorage<{ developer: boolean }>(
    DEVELOPER_MODE_KEY,
    { developer: false }
  );

  const setDeveloper = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setDevObj((prev) => ({
        developer:
          typeof next === "function"
            ? (next as (p: boolean) => boolean)(prev.developer)
            : Boolean(next),
      }));
    },
    [setDevObj]
  );

  return [devObj.developer, setDeveloper] as const;
}
