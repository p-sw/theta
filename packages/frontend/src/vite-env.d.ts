/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  VITE_BACKEND_URL: string;
  VITE_PROXY_MAX_RETRIES?: string;
  VITE_PROXY_RETRY_BASE_DELAY_MS?: string;
  VITE_PROXY_MAX_CONCURRENCY?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
