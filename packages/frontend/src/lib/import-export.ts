export const EXPORT_SCHEMA = "theta.localStorage.v1";

interface LocalStorageExportV1 {
  schema: typeof EXPORT_SCHEMA;
  exportedAt: string;
  storageType: "local";
  data: Record<string, string>;
}

function assertIsObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid import file: expected a JSON object");
  }
}

import { localStorage } from "@/lib/storage";

export function buildLocalStorageExport(): LocalStorageExportV1 {
  const data: Record<string, string> = {};
  for (const key of localStorage.getKeys()) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return {
    schema: EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    storageType: "local",
    data,
  };
}

export function downloadLocalStorageExport(filename?: string) {
  const content = buildLocalStorageExport();
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(".", "-");
  a.href = url;
  a.download = filename ?? `theta-settings-export-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importLocalStorageFromObject(obj: unknown, options?: { merge?: boolean }) {
  assertIsObject(obj);
  const schema = obj["schema"];
  const storageType = obj["storageType"];
  const data = obj["data"];

  if (schema !== EXPORT_SCHEMA) {
    throw new Error("Invalid import file: unsupported schema");
  }
  if (storageType !== "local") {
    throw new Error("Invalid import file: storageType must be 'local'");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid import file: malformed data");
  }

  const keyValues = data as Record<string, unknown>;

  if (!options?.merge) {
    localStorage.clear();
  }

  for (const [key, value] of Object.entries(keyValues)) {
    if (typeof value !== "string") continue; // skip non-string values
    localStorage.setItem(key, value);
  }
}

export async function importLocalStorageFromFile(file: File, options?: { merge?: boolean }) {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("Invalid import file: not valid JSON");
  }
  importLocalStorageFromObject(parsed, options);
}