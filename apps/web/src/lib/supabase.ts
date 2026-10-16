import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_KEYS, safeLocal } from "./storage";

/**
 * Kết nối Supabase (ADR 0011): tài khoản khách/Google, lịch sử, bảng xếp hạng.
 *
 * - Chỉ dùng khoá PUBLISHABLE (NFR-SEC-03). Thiếu biến môi trường → `SUPABASE_CONFIGURED = false`,
 *   mọi chỗ gọi nhận `null` và báo "Chưa kết nối máy chủ dữ liệu" (FR-MR-15), không văng lỗi.
 * - Thư viện supabase-js (~50 KB gzip) tải lười thành chunk riêng: chỉ tải khi cần lưu/xem dữ liệu,
 *   khi máy đã có phiên, hoặc khi vừa quay về từ trang đăng nhập Google.
 */

const URL_ENV = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const KEY_ENV = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const SUPABASE_CONFIGURED = URL_ENV !== "" && KEY_ENV !== "";

let clientPromise: Promise<SupabaseClient> | null = null;

/** Client Supabase dùng chung; `null` khi chưa cấu hình. Lỗi tải chunk → reject (lần sau thử lại). */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!SUPABASE_CONFIGURED) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(URL_ENV, KEY_ENV, {
        auth: {
          storageKey: STORAGE_KEYS.auth,
          persistSession: true,
          autoRefreshToken: true,
          // Quay về từ Google (PKCE `?code=`) → supabase-js tự đổi code lấy phiên rồi xoá khỏi URL.
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      }),
    )
    .catch((err) => {
      clientPromise = null;
      throw err;
    });
  return clientPromise;
}

/** Máy đã có phiên Supabase lưu từ trước (không cần tải thư viện để biết). */
export function hasStoredSession(): boolean {
  return safeLocal.get(STORAGE_KEYS.auth) !== null;
}

/** Lỗi Supabase/Google gửi kèm URL khi quay về (`?error=…&error_code=…`). */
export interface OAuthReturnError {
  /** vd. `identity_already_exists`, `access_denied` */
  code: string;
  description: string;
}

export interface OAuthReturn {
  /** URL có `code` của luồng PKCE: supabase-js sẽ đổi lấy phiên. */
  hasCode: boolean;
  error: OAuthReturnError | null;
  /** URL đã bỏ các tham số lỗi (để tải lại trang không báo lỗi lần nữa); `null` nếu không đổi. */
  cleanedUrl: string | null;
}

const ERROR_PARAMS = ["error", "error_code", "error_description", "sb"] as const;

/**
 * Đọc kết quả quay về từ trang đăng nhập (hàm thuần, có test). Lỗi có thể nằm ở query (PKCE)
 * hoặc ở hash (implicit). Không có lỗi và không có `code` → không phải lượt quay về.
 */
export function parseOAuthReturn(href: string): OAuthReturn {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const read = (key: string) => url.searchParams.get(key) ?? hash.get(key);

  const errorName = read("error");
  const errorCode = read("error_code");
  const description = read("error_description");
  const error =
    errorName || errorCode || description
      ? {
          code: errorCode || errorName || "unknown",
          description: description ?? "",
        }
      : null;

  let cleanedUrl: string | null = null;
  if (error) {
    for (const key of ERROR_PARAMS) {
      url.searchParams.delete(key);
      hash.delete(key);
    }
    const rest = hash.toString();
    url.hash = rest ? `#${rest}` : "";
    cleanedUrl = url.toString();
  }
  return { hasCode: url.searchParams.has("code"), error, cleanedUrl };
}
