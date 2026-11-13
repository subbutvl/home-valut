/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Google OAuth client ID (public, not a secret). Set in .env */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
