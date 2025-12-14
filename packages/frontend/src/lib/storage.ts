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

export class StorageWrapper implements Storage {
  private storage: Storage;
  private keys: Set<string>;
  private bufferTargets: Set<string>;
  private bufferValues: Map<string, string | null>;
  private deferTargets: Map<string, number>;
  private deferDelayedUntil: Map<string, number>;
  private deferPendingValues: Map<string, string>;
  private deferTimers: Map<string, number>;

  public readonly Buffer: {
    target: (key: string) => void;
    finish: (key?: string) => void;
  };

  public readonly Defer: {
    target: (key: string, delayMs?: number) => void;
    finish: (key?: string) => void;
    clear: (key?: string) => void;
  };

  private isLocal(): boolean {
    return this.storage === window.localStorage;
  }

  private isBufferTarget(key: string): boolean {
    return this.bufferTargets.has(key);
  }

  private ensureBuffered(key: string): void {
    if (key === VERSION_KEY) return;
    if (this.bufferTargets.has(key)) return;
    this.bufferTargets.add(key);
    if (!this.bufferValues.has(key)) {
      this.bufferValues.set(key, this.storage.getItem(key));
    }
  }

  private finishBuffered(key?: string): void {
    const now = Date.now();
    const targets = key ? [key] : Array.from(this.bufferTargets);

    for (const targetKey of targets) {
      if (!this.bufferTargets.has(targetKey)) continue;
      const bufferedValue = this.bufferValues.has(targetKey)
        ? (this.bufferValues.get(targetKey) ?? null)
        : this.storage.getItem(targetKey);
      const underlyingValue = this.storage.getItem(targetKey);
      const changed = underlyingValue !== bufferedValue;

      if (changed) {
        if (bufferedValue === null) {
          this.storage.removeItem(targetKey);
        } else {
          this.storage.setItem(targetKey, bufferedValue);
        }
      }

      this.bufferTargets.delete(targetKey);
      this.bufferValues.delete(targetKey);

      if (changed) {
        this.touchVersion(targetKey, now);
      }
    }
  }

  private isDeferTarget(key: string): boolean {
    return this.deferTargets.has(key);
  }

  private isDeferDelayed(key: string, now = Date.now()): boolean {
    const until = this.deferDelayedUntil.get(key);
    return typeof until === "number" && now < until;
  }

  private cancelDefer(key: string): void {
    const timer = this.deferTimers.get(key);
    if (typeof timer === "number") {
      clearTimeout(timer);
    }
    this.deferTimers.delete(key);
    this.deferDelayedUntil.delete(key);
    this.deferPendingValues.delete(key);
  }

  private cancelDeferTimer(key: string): void {
    const timer = this.deferTimers.get(key);
    if (typeof timer === "number") {
      clearTimeout(timer);
    }
    this.deferTimers.delete(key);
    this.deferDelayedUntil.delete(key);
  }

  private flushDeferred(key: string): void {
    const pendingValue = this.deferPendingValues.get(key);
    this.cancelDefer(key);
    if (pendingValue === undefined) return;

    const previousValue = this.storage.getItem(key);
    const delta = [this.getStorageEventDelta(key, pendingValue, previousValue)];

    const isNewKey = !this.keys.has(key);
    this.storage.setItem(key, pendingValue);
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

  private startDeferWindow(key: string, delayMs: number): void {
    const now = Date.now();
    this.deferDelayedUntil.set(key, now + delayMs);
    const existing = this.deferTimers.get(key);
    if (typeof existing === "number") {
      clearTimeout(existing);
    }
    const handle = window.setTimeout(() => {
      this.flushDeferred(key);
    }, delayMs);
    this.deferTimers.set(key, handle);
  }

  private getEffectiveItem(key: string): string | null {
    if (this.isBufferTarget(key)) {
      if (this.bufferValues.has(key)) {
        return this.bufferValues.get(key) ?? null;
      }
      return this.storage.getItem(key);
    }
    if (this.isDeferTarget(key) && this.deferPendingValues.has(key)) {
      return this.deferPendingValues.get(key) ?? null;
    }
    return this.storage.getItem(key);
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
    if (this.isBufferTarget(key)) return; // defer when buffered
    const map = this.readVersionMap();
    map[key] = timestamp ?? Date.now();
    this.writeVersionMap(map);
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
    newValue: string | null,
    previousValue: string | null
  ): IStorageChangeEventDelta {
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
    this.bufferTargets = new Set();
    this.bufferValues = new Map();
    this.deferTargets = new Map();
    this.deferDelayedUntil = new Map();
    this.deferPendingValues = new Map();
    this.deferTimers = new Map();
    // Ensure version map exists for local storage
    if (this.isLocal() && this.storage.getItem(VERSION_KEY) === null) {
      this.storage.setItem(VERSION_KEY, JSON.stringify({} satisfies IVersionMap));
    }

    this.Buffer = {
      target: (key: string) => {
        this.ensureBuffered(key);
      },
      finish: (key?: string) => {
        this.finishBuffered(key);
      },
    };

    this.Defer = {
      target: (key: string, delayMs = 150) => {
        if (key === VERSION_KEY) return;
        this.deferTargets.set(key, delayMs);
      },
      finish: (key?: string) => {
        const targets = key ? [key] : Array.from(this.deferTargets.keys());
        for (const targetKey of targets) {
          this.flushDeferred(targetKey);
        }
      },
      clear: (key?: string) => {
        const targets = key ? [key] : Array.from(this.deferTargets.keys());
        for (const targetKey of targets) {
          this.cancelDefer(targetKey);
          this.deferTargets.delete(targetKey);
        }
      },
    };
  }

  get length(): number {
    return this.keys.size;
  }

  clear(): void {
    // Prevent delayed flushes from resurrecting cleared data
    for (const key of Array.from(this.deferTargets.keys())) {
      this.cancelDeferTimer(key);
    }
    if (this.bufferTargets.size > 0) {
      this.finishBuffered();
    }

    const now = Date.now();
    const keysToClear = Array.from(this.keys).filter(
      (k) => !(this.isLocal() && k === VERSION_KEY)
    );
    const delta = keysToClear.map((key) => {
      // do not fire event
      const previousValue = this.getEffectiveItem(key);
      this.storage.removeItem(key);
      this.keys.delete(key);
      this.touchVersion(key, now);
      return this.getStorageEventDelta(key, null, previousValue);
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

    this.deferPendingValues.clear();
  }

  getItem(key: string): string | null {
    return this.getEffectiveItem(key);
  }

  key(index: number): string | null {
    return Array.from(this.keys)[index] ?? null;
  }

  getKeys(): string[] {
    return Array.from(this.keys);
  }

  removeItem(key: string): void {
    const previousValue = this.getEffectiveItem(key);
    const hadKey = previousValue !== null;
    if (!hadKey) return;

    // If this key is deferred and has a pending flush, cancel it.
    if (this.isDeferTarget(key)) {
      this.cancelDefer(key);
    }

    if (this.isBufferTarget(key)) {
      this.bufferValues.set(key, null);
    } else {
      this.storage.removeItem(key);
      this.touchVersion(key);
    }

    this.keys.delete(key);

    const detail: IStorageChangeEventStorage = {
      ...this.getStorageEventBase(),
      hasRemoved: true,
      delta: [this.getStorageEventDelta(key, null, previousValue)],
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

  setItem(key: string, value: string): void {
    if (!this.isBufferTarget(key) && this.isDeferTarget(key)) {
      const now = Date.now();
      if (this.isDeferDelayed(key, now)) {
        this.deferPendingValues.set(key, value);
        return;
      }
    }

    const previousValue = this.getEffectiveItem(key);
    const delta = [this.getStorageEventDelta(key, value, previousValue)];

    const isNewKey = !this.keys.has(key);
    if (this.isBufferTarget(key)) {
      this.bufferValues.set(key, value);
    } else {
      this.storage.setItem(key, value);
      this.touchVersion(key);
    }

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

    if (!this.isBufferTarget(key) && this.isDeferTarget(key)) {
      const delayMs = this.deferTargets.get(key) ?? 150;
      this.startDeferWindow(key, delayMs);
    }
  }
}

export const localStorage = new StorageWrapper(window.localStorage);
export const sessionStorage = new StorageWrapper(window.sessionStorage);
