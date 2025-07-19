import type { IProvider } from "@/sdk/shared";

export const STORAGE_CHANGE_EVENT = (key: string) => `storage-change-${key}`;

export const THEME = "theme";
export type ITheme = "light" | "dark";

export const PATH = "path";
export const PATHS = {
  CHAT: "/",
  SETTINGS: "/settings",
};

export const API_KEY = "api_key";
export type IApiKey = Record<IProvider, string | null>;

export const MODELS = "models";
export const SELECTED_MODEL = "selected_model";
