/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox public token (starts with pk.). Enables the embedded map. */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}