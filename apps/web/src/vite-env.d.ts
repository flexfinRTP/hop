/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONFIRM_TINYBARS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
