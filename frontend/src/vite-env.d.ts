/// <reference types="vite/client" />

interface ImportMetaEnv {
  // No environment variables needed for maps (OpenStreetMap is free)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
