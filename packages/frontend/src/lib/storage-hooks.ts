import {
  API_KEY,
  MODELS,
  PATH,
  PATHS,
  SELECTED_MODEL,
  THEME,
  type IApiKey,
  type ITheme,
} from "@/lib/const";
import { useStorage } from "@/lib/utils";
import type { IModelInfo, IProvider } from "@/sdk/shared";

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
