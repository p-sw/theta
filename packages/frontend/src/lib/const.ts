import type { IProvider } from "@/sdk/shared";

/*
 * STORAGE CHANGE EVENTS
 */
export interface IStorageChangeEventDelta {
  type: "new" | "removed" | "changed" | "same";
  key: string;
  previousValue: string | null;
  newValue: string | null;
}
export interface IStorageChangeEventStorage {
  storageType: "local" | "session";
  keys: string[];
  isCleared: boolean;
  hasNew: boolean;
  hasRemoved: boolean;
  hasChanged: boolean;
  delta: IStorageChangeEventDelta[];
}

export const STORAGE_CHANGE_EVENT = (key: string) => `storage-change-${key}`;
export type StorageChangeEventBody = IStorageChangeEventStorage;
export type StorageChangeEvent = CustomEvent<StorageChangeEventBody>;

// fired when any storage key is set/removed - to fire a storage event for current tab
export const STORAGE_CHANGE_EVENT_ALL = "storage";
export type StorageChangeEventAllBody = IStorageChangeEventStorage;
export type StorageChangeEventAll = CustomEvent<StorageChangeEventAllBody>;

// fired when storage key list changes (key added/removed)
export const STORAGE_CHANGE_EVENT_KEY = "storage-change-key";
export type StorageChangeEventKeyBody = IStorageChangeEventStorage;
export type StorageChangeEventKey = CustomEvent<StorageChangeEventKeyBody>;

/*
 * GLOBAL CONSTANTS
 */

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

export const TOOL_PROVIDER_CONFIG_KEY = (providerId: string) =>
  `tool-provider-config-${providerId}`;
export const TOOL_PROVIDER_CONFIG_ANY_KEY = "tool-provider-config";
export const TOOL_PROVIDER_ENABLED_KEY = "tool-provider-enabled";
export const TOOL_PROVIDER_AVAILABILITY_KEY = "tool-provider-availability";
export const TOOL_ENABLED_KEY = "tool-enabled";
export const TOOL_WHITELIST_KEY = "tool-whitelist";
export const TOOL_PROVIDER_SEPARATOR = "__";

export const AUTO_GRANT_TOOL_EVENT = "auto-grant-tool";
export type AutoGrantToolEventBody = { useId: string };
export type AutoGrantToolEvent = CustomEvent<AutoGrantToolEventBody>;

export const SESSION_STORAGE_KEY = (id: string) => `session-${id}`;
export const SESSION_STORAGE_ID = (key: string) =>
  key.split("-").slice(1).join("-");

export const NEW_SESSION_EVENT = "new-session";
export const SAVE_SESSION_EVENT = "save-session";

export const SYSTEM_PROMPTS_KEY = "system-prompts";
