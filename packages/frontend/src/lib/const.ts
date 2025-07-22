import type { IProvider } from "@/sdk/shared";

export const STORAGE_CHANGE_EVENT = (key: string) => `storage-change-${key}`;

// fired when any storage key is set/removed
export const STORAGE_CHANGE_EVENT_ALL = "storage-change";

export const THEME = "theme";
export type ITheme = "light" | "dark";

export const PATH = "path";
export const PATHS = {
  CHAT: "/",
  SETTINGS: "/settings",
  SESSIONS: "/sessions",
};

export const API_KEY = "api_key";
export type IApiKey = Record<IProvider, string | null>;

export const MODELS = "models";
export const SELECTED_MODEL = "selected_model";
export const PER_MODEL_CONFIG_KEY = (provider: IProvider, model: string) =>
  `model-config-${provider}-${model}`;

export const SESSION_STORAGE_KEY = (id: string) => `session-${id}`;
export const SESSION_STORAGE_ID = (key: string) =>
  key.split("-").slice(1).join("-");

export const NEW_SESSION_EVENT = "new-session";
export const CLEAR_SESSION_EVENT = "clear-session";
export const SAVE_SESSION_EVENT = "save-session";
