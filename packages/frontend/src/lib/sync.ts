import {
  SYNC_ENABLED_KEY,
  SYNC_EXCLUDED_KEYS,
  SYNC_INTERVAL_MS,
  SYNC_KEY_KEY,
  VERSION_KEY,
  type IVersionMap,
} from "@/lib/const";
import { localStorage } from "@/lib/storage";

interface SyncGenerateResponse {
  syncKey: string;
}

interface SyncDiffRequest {
  syncKey: string;
  version: IVersionMap;
}

interface SyncDiffResponse {
  // Keys whose server version is newer than client; values include the new value and its updatedAt
  updates: Record<string, { value: string | null; updatedAt: number }>;
  // The merged server version after applying server updates (so client can replace its VERSION_KEY)
  version: IVersionMap;
}

interface SyncUploadRequest {
  syncKey: string;
  changes: Record<string, { value: string | null; updatedAt: number }>;
}

export async function generateNewSyncKey(): Promise<string> {
  // prepare full snapshot of current localStorage excluding excluded keys, plus version map
  const version: IVersionMap = JSON.parse(
    localStorage.getItem(VERSION_KEY) ?? "{}"
  );
  const data: Record<string, string> = {};
  for (const key of localStorage.getKeys()) {
    if (SYNC_EXCLUDED_KEYS.has(key)) continue;
    const v = localStorage.getItem(key);
    if (v !== null) data[key] = v;
  }

  const resp = await fetch(
    new URL("/sync/generate", import.meta.env.VITE_BACKEND_URL),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, version }),
    }
  );
  if (!resp.ok) throw new Error("Failed to generate sync key");
  const json = (await resp.json()) as SyncGenerateResponse;
  return json.syncKey;
}

export async function enableSyncWithExisting(): Promise<void> {
  await runDiffCycle();
}

function applyServerUpdates(
  updates: Record<string, { value: string | null; updatedAt: number }>,
  nextVersion: IVersionMap
) {
  for (const [key, { value }] of Object.entries(updates)) {
    if (value === null) {
      localStorage.removeItem(key);
      // version removal handled by StorageWrapper.removeItem -> removeVersion
    } else {
      localStorage.setItem(key, value);
    }
  }
  localStorage.setItem(VERSION_KEY, JSON.stringify(nextVersion));
}

let diffCycleLock = false;
async function runDiffCycle(): Promise<void> {
  if (diffCycleLock) return;
  diffCycleLock = true;

  const enabled = localStorage.getItem(SYNC_ENABLED_KEY) === "true";
  const syncKey = localStorage.getItem(SYNC_KEY_KEY);
  if (!enabled || !syncKey) return;

  const localVersion: IVersionMap = JSON.parse(
    localStorage.getItem(VERSION_KEY) ?? "{}"
  );

  // 1) Fetch server-side newer keys
  const diffResp = await fetch(
    new URL("/sync/diff", import.meta.env.VITE_BACKEND_URL),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        syncKey,
        version: localVersion,
      } satisfies SyncDiffRequest),
    }
  );
  if (!diffResp.ok) return; // silent failure; try again later
  const serverDiff = (await diffResp.json()) as SyncDiffResponse;
  if (Object.keys(serverDiff.updates).length > 0) {
    applyServerUpdates(serverDiff.updates, serverDiff.version);
  }

  // 2) Upload client-side newer keys
  const nextLocalVersion: IVersionMap = JSON.parse(
    localStorage.getItem(VERSION_KEY) ?? "{}"
  );
  const changes: Record<string, { value: string | null; updatedAt: number }> =
    {};
  // Compute keys where local version is newer than server version
  for (const [key, updatedAt] of Object.entries(nextLocalVersion)) {
    if (SYNC_EXCLUDED_KEYS.has(key)) continue;
    const serverTs = serverDiff.version[key] ?? 0;
    if (updatedAt > serverTs) {
      changes[key] = {
        value: localStorage.getItem(key),
        updatedAt,
      };
    }
  }
  if (Object.keys(changes).length > 0) {
    const uploadResp = await fetch(
      new URL("/sync/upload", import.meta.env.VITE_BACKEND_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncKey, changes } satisfies SyncUploadRequest),
      }
    );
    if (uploadResp.ok) {
      const merged = (await uploadResp.json()) as { version: IVersionMap };
      localStorage.setItem(VERSION_KEY, JSON.stringify(merged.version));
    }
  }

  diffCycleLock = false;
}

let intervalId: number | null = null;

export function startSyncDaemon() {
  if (intervalId !== null) return;
  intervalId = window.setInterval(runDiffCycle, SYNC_INTERVAL_MS);
}

export function stopSyncDaemon() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
