/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  /** Supabase (ADR 0011). Thiếu một trong hai → tính năng tài khoản tắt êm (FR-MR-15). */
  readonly VITE_SUPABASE_URL?: string;
  /** Khoá PUBLISHABLE (công khai được). Không bao giờ đặt khoá secret ở web (NFR-SEC-03). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
