import {
  STORAGE_CHANGE_EVENT,
  STORAGE_CHANGE_EVENT_ALL,
  STORAGE_CHANGE_EVENT_KEY,
  type IStorageChangeEventDelta,
  type IStorageChangeEventStorage,
  type StorageChangeEventBody,
  type StorageChangeEventAllBody,
  type StorageChangeEventKeyBody,
  VERSION_KEY,
  type IVersionMap,
} from "@/lib/const";
import { dispatchEvent } from "@/lib/utils";

class StorageWrapper implements Storage {
  private storage: Storage;
  private keys: Set<string>;

  private isLocal(): boolean {
    return this.storage === window.localStorage;
  }

  private readVersionMap(): IVersionMap {
    if (!this.isLocal()) return {};
    try {
      const raw = this.storage.getItem(VERSION_KEY);
      return raw ? (JSON.parse(raw) as IVersionMap) : {};
    } catch {
      return {};
    }
  }

  private writeVersionMap(map: IVersionMap): void {
    if (!this.isLocal()) return;
    // Avoid recursive touch when writing VERSION_KEY itself by using native storage
    this.storage.setItem(VERSION_KEY, JSON.stringify(map));
  }

  private touchVersion(key: string, timestamp?: number): void {
    if (!this.isLocal()) return;
    if (key === VERSION_KEY) return; // never version VERSION_KEY itself
    const map = this.readVersionMap();
    map[key] = timestamp ?? Date.now();
    this.writeVersionMap(map);
  }

  private removeVersion(key: string): void {
    if (!this.isLocal()) return;
    if (key === VERSION_KEY) return;
    const map = this.readVersionMap();
    if (key in map) {
      delete map[key];
      this.writeVersionMap(map);
    }
  }

  private getStorageType(): "local" | "session" {
    return this.storage === window.localStorage ? "local" : "session";
  }

  private getStorageEventBase(): Omit<IStorageChangeEventStorage, "delta"> {
    return {
      storageType: this.getStorageType(),
      keys: Array.from(this.keys),
      isCleared: false,
      hasNew: false,
      hasRemoved: false,
      hasChanged: false,
    };
  }

  private getStorageEventDelta(
    key: string,
    newValue: string | null
  ): IStorageChangeEventDelta {
    const previousValue = this.storage.getItem(key);
    const isNew = previousValue === null;
    const isRemoved = newValue === null;
    const isChanged = !isNew && !isRemoved && previousValue !== newValue; // string -> string
    const isSame = previousValue === newValue;
    let type!: IStorageChangeEventDelta["type"];
    switch (true) {
      case isNew:
        type = "new";
        break;
      case isRemoved:
        type = "removed";
        break;
      case isChanged:
        type = "changed";
        break;
      case isSame:
        type = "same";
        break;
      default:
        console.warn(
          `Unknown storage change type for key ${key}, previousValue: ${previousValue}, newValue: ${newValue}`
        );
        type = "changed";
        break;
    }

    return {
      key,
      type,
      previousValue,
      newValue,
    };
  }

  constructor(storage: Storage) {
    this.storage = storage;
    this.keys = new Set(Object.keys(storage));
    // Ensure version map exists for local storage
    if (this.isLocal() && this.storage.getItem(VERSION_KEY) === null) {
      this.storage.setItem(VERSION_KEY, JSON.stringify({} satisfies IVersionMap));
    }
  }

  get length(): number {
    return this.storage.length;
  }

  clear(): void {
    const now = Date.now();
    const keysToClear = Array.from(this.keys).filter(
      (k) => !(this.isLocal() && k === VERSION_KEY)
    );
    const delta = keysToClear.map((key) => {
      // do not fire event
      const previousValue = this.storage.getItem(key);
      this.storage.removeItem(key);
      this.keys.delete(key);
      this.removeVersion(key);
      return this.getStorageEventDelta(key, previousValue);
    });
    const hadKeys = delta.length > 0;

    dispatchEvent<StorageChangeEventAllBody>(STORAGE_CHANGE_EVENT_ALL, {
      detail: {
        ...this.getStorageEventBase(),
        isCleared: true,
        hasRemoved: hadKeys,
        delta,
      },
    });
    if (hadKeys) {
      dispatchEvent<StorageChangeEventKeyBody>(STORAGE_CHANGE_EVENT_KEY, {
        detail: {
          ...this.getStorageEventBase(),
          isCleared: true,
          hasRemoved: hadKeys,
          delta,
        },
      });
    }
  }

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  key(index: number): string | null {
    return this.storage.key(index);
  }

  getKeys(): string[] {
    return Array.from(this.keys);
  }

  removeItem(key: string): void {
    const hadKey = this.keys.has(key);
    this.storage.removeItem(key);

    if (hadKey) {
      this.keys.delete(key);
      this.removeVersion(key);
      const detail: IStorageChangeEventStorage = {
        ...this.getStorageEventBase(),
        hasRemoved: true,
        delta: [this.getStorageEventDelta(key, null)],
      };

      dispatchEvent<StorageChangeEventAllBody>(STORAGE_CHANGE_EVENT_ALL, {
        detail,
      });
      dispatchEvent<StorageChangeEventKeyBody>(STORAGE_CHANGE_EVENT_KEY, {
        detail,
      });
      dispatchEvent<StorageChangeEventBody>(STORAGE_CHANGE_EVENT(key), {
        detail,
      });
    }
  }

  setItem(key: string, value: string): void {
    const delta = [this.getStorageEventDelta(key, value)];

    const isNewKey = !this.keys.has(key);
    this.storage.setItem(key, value);
    this.touchVersion(key);

    if (isNewKey) {
      this.keys.add(key);
    }

    const detail: IStorageChangeEventStorage = {
      ...this.getStorageEventBase(),
      hasNew: isNewKey,
      hasChanged: !isNewKey,
      delta,
    };

    dispatchEvent<StorageChangeEventAllBody>(STORAGE_CHANGE_EVENT_ALL, {
      detail,
    });
    if (isNewKey) {
      dispatchEvent<StorageChangeEventKeyBody>(STORAGE_CHANGE_EVENT_KEY, {
        detail,
      });
    }
    dispatchEvent<StorageChangeEventBody>(STORAGE_CHANGE_EVENT(key), {
      detail,
    });
  }
}

export const localStorage = new StorageWrapper(window.localStorage);
export const sessionStorage = new StorageWrapper(window.sessionStorage);
