/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  VITE_BACKEND_URL: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
