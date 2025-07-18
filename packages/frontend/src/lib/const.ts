export const STORAGE_CHANGE_EVENT = (key: string) => `storage-change-${key}`;

export const THEME = "theme";
export type ITheme = "light" | "dark";

export const PATH = "path";
export const PATHS = {
  CHAT: "/",
  SETTINGS: "/settings",
};

export const API_KEY = "api_key";
export interface IApiKey {
  anthropic: string;
}

export const MODELS = "models";
