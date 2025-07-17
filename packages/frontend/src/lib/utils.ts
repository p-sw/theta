import { STORAGE_CHANGE_EVENT } from "@/lib/const";
import { clsx, type ClassValue } from "clsx";
import { useCallback, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IStorageOptions {
  temp?: boolean;
}

export function useStorage<T>(
  key: string,
  fallbackValue: T,
  parse: {
    set: (value: string) => T;
    get: (value: T) => string;
  },
  options?: IStorageOptions
): [T, (value: T) => void];
export function useStorage<T extends string>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>,
  options?: IStorageOptions
): [T, (value: T) => void];
export function useStorage<T>(
  key: string,
  fallbackValue: T,
  parse?: Partial<{
    get: (value: string) => T;
    set: (value: T) => string;
  }>,
  options?: IStorageOptions
): [T, (value: T | ((prev: T) => T)) => void] {
  const storage = options?.temp ? sessionStorage : localStorage;
  const getParse = parse?.get ?? ((v: string) => v as T);
  const setParse = parse?.set ?? ((v: T) => v as string);

  const updateFromStorage = useCallback(() => {
    setValue(getParse(storage.getItem(key)!));
  }, [key]);

  const updateToStorage = useCallback(
    (updator: T | ((prev: T) => T)) => {
      const modified =
        typeof updator === "function"
          ? (updator as (prev: T) => T)(value)
          : updator;
      setValue(modified);
      storage.setItem(key, setParse(modified));
      window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT(key)));
    },
    [key]
  );

  const initKey = useCallback(() => {
    const item = storage.getItem(key);
    return item ? getParse(item) : fallbackValue;
  }, [key]);

  const [value, setValue] = useState<T>(initKey);

  /* key change event, re-initialize */
  useEffect(() => {
    setValue(initKey());
    // listen to key change event
    window.addEventListener(STORAGE_CHANGE_EVENT(key), updateFromStorage);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT(key), updateFromStorage);
    };
  }, [key]);

  return [value, updateToStorage];
}
