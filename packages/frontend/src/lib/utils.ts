import { STORAGE_CHANGE_EVENT, STORAGE_CHANGE_EVENT_KEY } from "@/lib/const";
import { localStorage, sessionStorage } from "@/lib/storage";
import type {
  SessionTurns,
  SessionTurnsRequest,
  SessionTurnsResponse,
  SessionTurnsTool,
} from "@/sdk/shared";
import { clsx, type ClassValue } from "clsx";
import hyperid from "hyperid";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IStorageOptions {
  temp?: boolean;
}

export function dispatchEvent<T = unknown>(
  key: string,
  data: CustomEventInit<T>
) {
  window.dispatchEvent(new CustomEvent<T>(key, data));
}

export function useEventListener<T extends Event = Event>(
  key: string,
  onEvent: (event: T) => void
) {
  useEffect(() => {
    window.addEventListener(key, onEvent as (event: Event) => void);
    return () => {
      window.removeEventListener(key, onEvent as (event: Event) => void);
    };
  }, [key, onEvent]);
}

export function useStorage<T>(
  key: string,
  fallbackValue: T,
  parse: {
    set: (value: string) => T;
    get: (value: T) => string;
  },
  options?: IStorageOptions
): [T, (value: T | ((prev: T) => T)) => void];
export function useStorage<T extends object>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>,
  options?: IStorageOptions
): [T, (value: T | ((prev: T) => T)) => void];
export function useStorage<T extends string>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>,
  options?: IStorageOptions
): [T, (value: T | ((prev: T) => T)) => void];
export function useStorage<T extends unknown[]>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>
): [T, (value: T | ((prev: T) => T)) => void];
export function useStorage<T>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>,
  options?: IStorageOptions
): [T, (value: T | ((prev: T) => T)) => void] {
  const storage = useMemo(
    () => (options?.temp ? sessionStorage : localStorage),
    [options?.temp]
  );
  const getParse = useMemo(
    () =>
      parse?.get ?? typeof fallbackValue === "object"
        ? (v: string) => JSON.parse(v) as T
        : (v: string) => v as T,
    [parse?.get, fallbackValue]
  );
  const setParse = useMemo(
    () =>
      parse?.set ??
      (typeof fallbackValue === "object"
        ? (v: T) => JSON.stringify(v)
        : (v: T) => v as string),
    [parse?.set, fallbackValue]
  );

  const updateFromStorage = useCallback(() => {
    const item = storage.getItem(key);
    if (!item) {
      setValue(fallbackValue);
    } else {
      setValue(getParse(item));
    }
  }, [storage, key, fallbackValue, getParse]);

  const initKey = useCallback(() => {
    const item = storage.getItem(key);
    if (!item) {
      storage.setItem(key, setParse(fallbackValue));
    }
    return item ? getParse(item) : fallbackValue;
  }, [key, getParse, fallbackValue, storage, setParse]);

  const [value, setValue] = useState<T>(initKey);

  const updateToStorage = useCallback(
    (updator: T | ((prev: T) => T)) => {
      const modified =
        typeof updator === "function"
          ? (updator as (prev: T) => T)(value)
          : updator;
      setValue(modified);
      storage.setItem(key, setParse(modified));
    },
    [key, setParse, storage, value]
  );

  /* key change event, re-initialize */
  useEffect(() => {
    setValue(initKey());
    // listen to key change event
    window.addEventListener(STORAGE_CHANGE_EVENT(key), updateFromStorage);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT(key), updateFromStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, updateToStorage];
}

export function useStorageKey({
  sessionStorage: _sessionStorage,
}: {
  sessionStorage: boolean;
}) {
  const [keys, setKeys] = useState<string[]>(() => {
    return (_sessionStorage ? sessionStorage : localStorage).getKeys();
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setKeys((_sessionStorage ? sessionStorage : localStorage).getKeys());
    };

    window.addEventListener(STORAGE_CHANGE_EVENT_KEY, handleStorageChange);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT_KEY, handleStorageChange);
    };
  }, [_sessionStorage]);

  return keys;
}

export const hyperidInstance = hyperid();

export function useHyperId() {
  const [id, setId] = useState<string>(hyperidInstance());

  useEffect(() => {
    setId(hyperidInstance());
  }, []);

  return id;
}

export function useHyperInstance() {
  return useMemo(() => hyperid(), []);
}

export function parseResponseSessionDisplayables(
  turn: SessionTurnsResponse
): SessionTurnsResponse {
  const displayableMessages = turn.message.filter(
    (message) =>
      (message.type === "text" && message.text.trim().length > 0) ||
      (message.type === "thinking" && message.thinking.trim().length > 0)
  );
  return {
    ...turn,
    message: displayableMessages,
  };
}

export function parseSessionDisplayables(sessionTurns: SessionTurns) {
  const turns: (
    | SessionTurnsRequest
    | SessionTurnsResponse
    | SessionTurnsTool[]
  )[] = [];

  for (const turn of sessionTurns) {
    if (turn.type === "request") {
      const displayableMessages = turn.message.filter(
        (message) => message.type === "text" && message.text.trim().length > 0
      );
      if (displayableMessages.length === 0) continue;
      turns.push({
        ...turn,
        message: displayableMessages,
      });
    } else if (turn.type === "response") {
      turns.push(parseResponseSessionDisplayables(turn));
    } else if (turn.type === "tool") {
      if (Array.isArray(turns.at(-1)))
        (turns.at(-1) as SessionTurnsTool[]).push(turn);
      else turns.push([turn]);
    }
  }
  return turns;
}

// Simple global in-memory store with subscription, for ephemeral app state
const globalStore = new Map<string, unknown>();
const storeSubscribers = new Map<string, Set<() => void>>();

function subscribeToKey(key: string, listener: () => void): () => void {
  let set = storeSubscribers.get(key);
  if (!set) {
    set = new Set();
    storeSubscribers.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

function notifyKey(key: string): void {
  const set = storeSubscribers.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export function useStore<T>(key: string, initialValue: T): [T, (next: T | ((prev: T) => T)) => void] {
  // Ensure initial value is seeded once
  if (!globalStore.has(key)) {
    globalStore.set(key, initialValue);
  }

  const getSnapshot = useCallback(() => {
    return (globalStore.get(key) as T) ?? initialValue;
  }, [key, initialValue]);

  const value = useSyncExternalStore(
    useCallback((cb) => subscribeToKey(key, cb), [key]),
    getSnapshot,
    getSnapshot
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = (globalStore.get(key) as T) ?? initialValue;
      const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(prev, nextValue)) return;
      globalStore.set(key, nextValue);
      notifyKey(key);
    },
    [key, initialValue]
  );

  return [value, setValue];
}
