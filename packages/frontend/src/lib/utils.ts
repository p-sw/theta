import { STORAGE_CHANGE_EVENT, STORAGE_CHANGE_EVENT_ALL } from "@/lib/const";
import { clsx, type ClassValue } from "clsx";
import hyperid from "hyperid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IStorageOptions {
  temp?: boolean;
}

export function dispatchEvent<T = unknown>(
  key: string,
  data?: CustomEventInit<T> | undefined
) {
  window.dispatchEvent(new CustomEvent<T>(key, data));
}

export function dispatchStorageEvent<T = unknown>(key: string, data?: T) {
  dispatchEvent(STORAGE_CHANGE_EVENT(key), { detail: data });
}

export function useEventListener<T = unknown>(
  key: string,
  onEvent: (event: CustomEvent<T>) => void
) {
  useEffect(() => {
    window.addEventListener(key, onEvent as EventListener);
    return () => {
      window.removeEventListener(key, onEvent as EventListener);
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
    setValue(getParse(storage.getItem(key)!));
  }, [key, getParse, storage]);

  const initKey = useCallback(() => {
    const item = storage.getItem(key);
    if (!item) {
      storage.setItem(key, setParse(fallbackValue));
      dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
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
      dispatchStorageEvent(key);
      dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
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
  const [keys, setKeys] = useState<string[]>(
    Object.keys(_sessionStorage ? sessionStorage : localStorage)
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setKeys(Object.keys(_sessionStorage ? sessionStorage : localStorage));
    };

    window.addEventListener(STORAGE_CHANGE_EVENT_ALL, handleStorageChange);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT_ALL, handleStorageChange);
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
