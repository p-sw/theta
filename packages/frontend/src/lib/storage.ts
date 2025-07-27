import {
  STORAGE_CHANGE_EVENT,
  STORAGE_CHANGE_EVENT_ALL,
  STORAGE_CHANGE_EVENT_KEY,
  type IStorageChangeEventDelta,
  type IStorageChangeEventStorage,
  type StorageChangeEventBody,
  type StorageChangeEventAllBody,
  type StorageChangeEventKeyBody,
} from "@/lib/const";
import { dispatchEvent } from "@/lib/utils";

class StorageWrapper implements Storage {
  private storage: Storage;
  private keys: Set<string>;

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
  }

  get length(): number {
    return this.storage.length;
  }

  clear(): void {
    const delta = Array.from(this.keys).map((key) => {
      // do not fire event
      const previousValue = this.storage.getItem(key);
      this.storage.removeItem(key);
      this.keys.delete(key);
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
      const detail: IStorageChangeEventStorage = {
        ...this.getStorageEventBase(),
        hasRemoved: true,
        delta: [this.getStorageEventDelta(key, null)],
      };

      dispatchEvent<StorageChangeEventBody>(STORAGE_CHANGE_EVENT(key), {
        detail,
      });
      dispatchEvent<StorageChangeEventAllBody>(STORAGE_CHANGE_EVENT_ALL, {
        detail,
      });
      dispatchEvent<StorageChangeEventKeyBody>(STORAGE_CHANGE_EVENT_KEY, {
        detail,
      });
    }
  }

  setItem(key: string, value: string): void {
    const delta = [this.getStorageEventDelta(key, value)];

    const isNewKey = !this.keys.has(key);
    this.storage.setItem(key, value);

    if (isNewKey) {
      this.keys.add(key);
    }

    const detail: IStorageChangeEventStorage = {
      ...this.getStorageEventBase(),
      hasNew: isNewKey,
      hasChanged: !isNewKey,
      delta,
    };

    dispatchEvent<StorageChangeEventBody>(STORAGE_CHANGE_EVENT(key), {
      detail,
    });
    dispatchEvent<StorageChangeEventAllBody>(STORAGE_CHANGE_EVENT_ALL, {
      detail,
    });
    if (isNewKey) {
      dispatchEvent<StorageChangeEventKeyBody>(STORAGE_CHANGE_EVENT_KEY, {
        detail,
      });
    }
  }
}

export const localStorage = new StorageWrapper(window.localStorage);
export const sessionStorage = new StorageWrapper(window.sessionStorage);
