/// <reference types="vite/client" />

declare const __GDP_BUILD_MODE__: string;

interface Window {
  __ENV__?: {
    BACKEND_API_BASE?: string;
    ENABLE_BACKEND_API?: string;
    ENABLE_EXTERNAL_ASSETS?: string;
  };
}
