import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { Database } from "bun:sqlite";
import crypto from "node:crypto";

// Schema definition for proxy requests
const ProxyRequestSchema = t.Object({
  url: t.String(),
  method: t.Union([
    t.Literal("GET"),
    t.Literal("POST"),
    t.Literal("PUT"),
    t.Literal("DELETE"),
    t.Literal("PATCH"),
    t.Literal("OPTIONS"),
    t.Literal("HEAD"),
  ]),
  headers: t.Record(t.String(), t.String()),
  data: t.Optional(t.Record(t.String(), t.Unknown())),
});

// Initialize SQLite database
const db = new Database("sync.db");
db.run(`CREATE TABLE IF NOT EXISTS sync_keys (
  key TEXT PRIMARY KEY,
  created_at INTEGER
)`);
db.run(`CREATE TABLE IF NOT EXISTS sync_kv (
  key_id TEXT,
  k TEXT,
  v TEXT,
  updated_at INTEGER,
  PRIMARY KEY (key_id, k),
  FOREIGN KEY (key_id) REFERENCES sync_keys(key) ON DELETE CASCADE
)`);

function generateKey(): string {
  return crypto.randomBytes(18).toString("base64url");
}

type VersionMap = Record<string, number>;

function getServerVersion(syncKey: string): VersionMap {
  const stmt = db.query(
    `SELECT k, updated_at FROM sync_kv WHERE key_id = $key`
  );
  const map: VersionMap = {};
  for (const row of stmt.iterate({ $key: syncKey }) as Iterable<{
    k: string;
    updated_at: number;
  }>) {
    map[row.k] = row.updated_at;
  }
  return map;
}

function getServerValues(
  syncKey: string,
  keys: string[]
): Record<string, { value: string | null; updatedAt: number }> {
  if (keys.length === 0) return {};
  const placeholders = keys.map((_, i) => `?`).join(",");
  const stmt = db.query(
    `SELECT k, v, updated_at FROM sync_kv WHERE key_id = ? AND k IN (${placeholders})`
  );
  const result: Record<string, { value: string | null; updatedAt: number }> =
    {};
  for (const row of stmt.iterate(syncKey, ...keys) as Iterable<{
    k: string;
    v: string | null;
    updated_at: number;
  }>) {
    result[row.k] = { value: row.v, updatedAt: row.updated_at };
  }
  // Include missing keys as deleted (null) if explicitly requested
  for (const k of keys) {
    if (!(k in result)) result[k] = { value: null, updatedAt: 0 };
  }
  return result;
}

function upsertServerChanges(
  syncKey: string,
  changes: Record<string, { value: string | null; updatedAt: number }>
) {
  const upsert = db.query(
    `INSERT INTO sync_kv (key_id, k, v, updated_at) VALUES ($key, $k, $v, $at)
     ON CONFLICT(key_id, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at
     WHERE excluded.updated_at > sync_kv.updated_at`
  );
  db.transaction(() => {
    for (const [k, { value, updatedAt }] of Object.entries(changes)) {
      upsert.run({ $key: syncKey, $k: k, $v: value, $at: updatedAt });
    }
  })();
}

const app = new Elysia()
  .use(cors()) // Add CORS support
  .post(
    "/proxy",
    async ({ body }) => {
      try {
        const { url, method, headers, data } = body;

        // Send proxy request
        const response = await fetch(url, {
          method,
          headers: {
            ...headers,
          },
          body: method === "GET" ? undefined : JSON.stringify(data),
        });
        response.headers.append("x-theta-proxied", "true");

        // Return the response directly with all original headers and body
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
      } catch (error) {
        console.error("Error occurred during proxy request:", error);

        return new Response(
          JSON.stringify({
            proxyerror:
              error instanceof Error
                ? error.message
                : "An unknown error occurred",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
    },
    {
      body: ProxyRequestSchema,
    }
  )
  // Generate new sync key and seed data
  .post(
    "/sync/generate",
    ({ body }) => {
      const { data, version } = body as {
        data: Record<string, string>;
        version: VersionMap;
      };
      const key = generateKey();
      db.run(`INSERT INTO sync_keys (key, created_at) VALUES (?, ?)`, [
        key,
        Date.now(),
      ]);
      const insert = db.query(
        `INSERT OR REPLACE INTO sync_kv (key_id, k, v, updated_at) VALUES ($key, $k, $v, $at)`
      );
      db.transaction(() => {
        for (const [k, v] of Object.entries(data)) {
          const updatedAt = version[k] ?? Date.now();
          insert.run({ $key: key, $k: k, $v: v, $at: updatedAt });
        }
      })();
      return { syncKey: key };
    },
    {
      body: t.Object({
        data: t.Record(t.String(), t.String()),
        version: t.Record(t.String(), t.Number()),
      }),
    }
  )
  // Return server-side updates newer than client's version
  .post(
    "/sync/diff",
    ({ body, set }) => {
      const { syncKey, version } = body as {
        syncKey: string;
        version: VersionMap;
      };
      // Validate that syncKey exists
      const exists = db
        .query(`SELECT key FROM sync_keys WHERE key = ?`)
        .get(syncKey) as { key: string } | undefined;
      if (!exists) {
        set.status = 404;
        return { error: "Sync key not found" };
      }
      const serverVersion = getServerVersion(syncKey);
      const newerKeys: string[] = [];
      for (const [k, serverTs] of Object.entries(serverVersion)) {
        const clientTs = version[k] ?? 0;
        if (serverTs > clientTs) newerKeys.push(k);
      }
      const updates = getServerValues(syncKey, newerKeys);
      return { updates, version: serverVersion } satisfies {
        updates: Record<string, { value: string | null; updatedAt: number }>;
        version: VersionMap;
      };
    },
    {
      body: t.Object({
        syncKey: t.String(),
        version: t.Record(t.String(), t.Number()),
      }),
    }
  )
  // Upload client-side newer changes and return merged version
  .post(
    "/sync/upload",
    ({ body, set }) => {
      const { syncKey, changes } = body as {
        syncKey: string;
        changes: Record<string, { value: string | null; updatedAt: number }>;
      };
      const exists = db
        .query(`SELECT key FROM sync_keys WHERE key = ?`)
        .get(syncKey) as { key: string } | undefined;
      if (!exists) {
        set.status = 404;
        return { error: "Sync key not found" };
      }
      upsertServerChanges(syncKey, changes);
      const serverVersion = getServerVersion(syncKey);
      return { version: serverVersion } as { version: VersionMap };
    },
    {
      body: t.Object({
        syncKey: t.String(),
        changes: t.Record(
          t.String(),
          t.Object({ value: t.Nullable(t.String()), updatedAt: t.Number() })
        ),
      }),
    }
  )
  .listen({ idleTimeout: 180, port: 3000 });

console.log(
  `🦊 Elysia proxy server is running at ${app.server?.hostname}:${app.server?.port}`
);
