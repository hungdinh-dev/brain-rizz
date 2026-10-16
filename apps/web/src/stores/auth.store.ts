import type { CharacterId } from "@brain-rizz/shared";
import { MAX_NAME_LENGTH } from "@brain-rizz/shared";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { STORAGE_KEYS, safeSession } from "@/lib/storage";
import {
  hasStoredSession,
  loadSupabase,
  parseOAuthReturn,
  SUPABASE_CONFIGURED,
} from "@/lib/supabase";

/**
 * Phiên tài khoản Supabase (UC-16, ADR 0011).
 *
 * - `not-configured`: thiếu biến môi trường → mọi thứ liên quan tài khoản tắt êm (FR-MR-15).
 * - `unknown`: đang đọc phiên đã lưu trên máy.
 * - `signed-out`: chưa có phiên. Phiên khách chỉ tạo LƯỜI qua `ensureSession()` (NFR-PRIV-01):
 *   khi tạo/vào phòng, bắt đầu Kiểm tra não, xong một lượt luyện tập, mở Tài khoản.
 * - `guest`: phiên khách ẩn danh. `google`: đã liên kết / đăng nhập Google.
 */
export type AuthStatus = "not-configured" | "unknown" | "signed-out" | "guest" | "google";

/** Vấn đề khi quay về từ trang đăng nhập Google. */
export type OAuthIssue =
  /** Luồng rẽ 3a: Google đã gắn với tài khoản khác → đề nghị Đăng nhập bằng Google. */
  "identity-taken" | "failed";

export interface ProfileForAccount {
  name: string;
  avatar: CharacterId;
}

interface AuthStore {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  oauthIssue: OAuthIssue | null;
  /** Gọi một lần lúc mở app. */
  init(): void;
  /** Có phiên thì trả token; chưa có thì tạo phiên khách. Lỗi/không cấu hình → `null`, không ném lỗi. */
  ensureSession(profile?: ProfileForAccount): Promise<string | null>;
  /** Token của phiên ĐANG có (không tạo phiên mới). */
  currentToken(): Promise<string | null>;
  /** Liên kết Google vào phiên hiện tại (giữ user_id). Chuyển trang sang Google; lỗi → `false`. */
  linkGoogle(): Promise<boolean>;
  /** Đăng nhập Google (tài khoản khác); bỏ phiên khách trên máy này. */
  signInGoogle(): Promise<boolean>;
  signOut(): Promise<void>;
  /** RPC `delete_my_data` rồi đăng xuất. */
  deleteMyData(): Promise<boolean>;
  /** Đồng bộ tên + nhân vật lên `profiles` (chỉ khi đã có phiên; trùng lần trước thì bỏ qua). */
  syncProfile(profile: ProfileForAccount): Promise<void>;
  clearOAuthIssue(): void;
}

/** Supabase tạm dừng / mạng chậm: không chờ quá ngần này rồi coi như lỗi (vẫn chơi được). */
export const DATA_TIMEOUT_MS = 6_000;

export function withTimeout<T>(promise: Promise<T>, ms = DATA_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

let subscribed = false;
let ensuring: Promise<string | null> | null = null;
let lastSynced = "";

function statusOf(session: Session | null): Pick<AuthStore, "status" | "userId" | "email"> {
  if (!session) return { status: "signed-out", userId: null, email: null };
  const user = session.user;
  return {
    status: user.is_anonymous ? "guest" : "google",
    userId: user.id,
    email: user.email ?? null,
  };
}

/** Tải client + nghe thay đổi phiên (một lần). */
async function client(): Promise<SupabaseClient | null> {
  const sb = await withTimeout(loadSupabase());
  if (sb && !subscribed) {
    subscribed = true;
    sb.auth.onAuthStateChange((_event, session) => {
      useAuth.setState(statusOf(session));
    });
  }
  return sb;
}

function redirectTo() {
  // Quay về trang gốc (URL Configuration của Supabase cho phép `<origin>/**`), rồi mở lại màn Tài khoản.
  safeSession.set(STORAGE_KEYS.oauthReturn, "account");
  return `${location.origin}/`;
}

export const useAuth = create<AuthStore>((set, get) => ({
  status: SUPABASE_CONFIGURED ? "unknown" : "not-configured",
  userId: null,
  email: null,
  oauthIssue: null,

  init() {
    if (!SUPABASE_CONFIGURED) return;
    const back = parseOAuthReturn(location.href);
    if (back.error) {
      if (back.cleanedUrl) history.replaceState(history.state, "", back.cleanedUrl);
      // Huỷ ở trang Google (luồng rẽ 3b) → giữ phiên khách, không báo gì.
      if (back.error.code !== "access_denied") {
        const taken =
          back.error.code === "identity_already_exists" ||
          /already (linked|exists)/i.test(back.error.description);
        set({ oauthIssue: taken ? "identity-taken" : "failed" });
      }
    }
    if (!hasStoredSession() && !back.hasCode) {
      set({ status: "signed-out" });
      return;
    }
    void (async () => {
      try {
        const sb = await client();
        if (!sb) return set({ status: "signed-out" });
        const { data } = await withTimeout(sb.auth.getSession());
        set(statusOf(data.session));
      } catch (err) {
        console.warn("[auth] Không đọc được phiên:", err);
        set({ status: "signed-out" });
      }
    })();
  },

  ensureSession(profile) {
    if (!SUPABASE_CONFIGURED) return Promise.resolve(null);
    ensuring ??= (async () => {
      try {
        const sb = await client();
        if (!sb) return null;
        const { data } = await withTimeout(sb.auth.getSession());
        let session = data.session;
        if (!session) {
          const res = await withTimeout(sb.auth.signInAnonymously());
          if (res.error) throw res.error;
          session = res.data.session;
        }
        set(statusOf(session));
        return session?.access_token ?? null;
      } catch (err) {
        console.warn("[auth] Không tạo được phiên:", err);
        return null;
      } finally {
        ensuring = null;
      }
    })();
    return ensuring.then((token) => {
      if (token && profile) void get().syncProfile(profile);
      return token;
    });
  },

  async currentToken() {
    if (!SUPABASE_CONFIGURED || !hasStoredSession()) return null;
    try {
      const sb = await client();
      const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  },

  async linkGoogle() {
    try {
      if (!(await get().ensureSession())) return false;
      const sb = await client();
      if (!sb) return false;
      const { error } = await sb.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: redirectTo() },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      safeSession.remove(STORAGE_KEYS.oauthReturn);
      console.warn("[auth] Không liên kết được Google:", err);
      return false;
    }
  },

  async signInGoogle() {
    try {
      const sb = await client();
      if (!sb) return false;
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo() },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      safeSession.remove(STORAGE_KEYS.oauthReturn);
      console.warn("[auth] Không đăng nhập được Google:", err);
      return false;
    }
  },

  async signOut() {
    lastSynced = "";
    try {
      const sb = await client();
      // `local`: chỉ bỏ phiên trên máy này, không cần mạng (Supabase tạm dừng vẫn đăng xuất được).
      await sb?.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[auth] Lỗi khi đăng xuất:", err);
    }
    set({ status: "signed-out", userId: null, email: null });
  },

  async deleteMyData() {
    try {
      const sb = await client();
      if (!sb) return false;
      const { error } = await withTimeout(Promise.resolve(sb.rpc("delete_my_data")));
      if (error) throw error;
    } catch (err) {
      console.warn("[auth] Không xoá được dữ liệu:", err);
      return false;
    }
    await get().signOut();
    return true;
  },

  async syncProfile(profile) {
    const { userId } = get();
    const name = profile.name.trim().slice(0, MAX_NAME_LENGTH);
    if (!userId || !name) return;
    const key = `${userId}|${name}|${profile.avatar}`;
    if (key === lastSynced) return;
    lastSynced = key;
    try {
      const sb = await client();
      const { error } =
        (await sb
          ?.from("profiles")
          .upsert({ id: userId, display_name: name, avatar: profile.avatar })) ?? {};
      if (error) throw error;
    } catch (err) {
      lastSynced = "";
      console.warn("[auth] Không đồng bộ được hồ sơ:", err);
    }
  },

  clearOAuthIssue: () => set({ oauthIssue: null }),
}));

/** Lần quay về từ Google: mở thẳng màn Tài khoản (đọc một lần rồi xoá dấu). */
export function takeOAuthReturnScreen(): boolean {
  const marked = safeSession.get(STORAGE_KEYS.oauthReturn) === "account";
  safeSession.remove(STORAGE_KEYS.oauthReturn);
  return marked;
}
