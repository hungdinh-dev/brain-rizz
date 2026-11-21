import type { CharacterId } from "@brain-rizz/shared";
import { MAX_NAME_LENGTH } from "@brain-rizz/shared";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { currentDeviceLabel } from "@/lib/device-label";
import {
  adoptAccountProfile,
  mergeAccountProfile,
  profileMeta,
  setProfileMeta,
  useProfile,
} from "@/lib/profile";
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

/** Sự kiện đăng nhập ghi qua RPC `log_login` (CR-019, cột `login_events.event`). */
export type LoginEvent =
  | "guest_created"
  | "google_sign_in"
  | "google_linked"
  | "session_resumed"
  | "sign_out";

/**
 * Kết quả xoá dữ liệu: `last-admin` = người gọi là quản trị viên duy nhất, RPC `delete_my_data`
 * từ chối (P0001) và không xoá gì — thêm quản trị viên khác trước (CR-019).
 */
export type DeleteDataResult = "deleted" | "last-admin" | "failed";

/** Quay về từ Google thì mở màn nào: Tài khoản (mặc định) hay trang quản trị `/admin`. */
export type OAuthReturnTarget = "account" | "admin";

/** Đường dẫn của trang quản trị (CR-019). */
export const ADMIN_PATH = "/admin";

export interface SignInGoogleOptions {
  returnTo?: OAuthReturnTarget;
  /** Hiện bảng chọn tài khoản Google (nút "Đổi tài khoản Google" ở trang quản trị). */
  selectAccount?: boolean;
}

/** Luồng Google đang đi, nhớ qua lần chuyển trang để ghi đúng `google_linked` / `google_sign_in`. */
type OAuthFlow = "link" | "signin";

interface AuthStore {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  oauthIssue: OAuthIssue | null;
  /** Đọc phiên lúc mở app. Chỉ chạy một lần mỗi lần tải trang; gọi lại trả cùng promise. */
  init(): Promise<void>;
  /** Có phiên thì trả token; chưa có thì tạo phiên khách. Lỗi/không cấu hình → `null`, không ném lỗi. */
  ensureSession(profile?: ProfileForAccount): Promise<string | null>;
  /** Token của phiên ĐANG có (không tạo phiên mới). */
  currentToken(): Promise<string | null>;
  /** Liên kết Google vào phiên hiện tại (giữ user_id). Chuyển trang sang Google; lỗi → `false`. */
  linkGoogle(): Promise<boolean>;
  /** Đăng nhập Google (tài khoản khác); bỏ phiên khách trên máy này. */
  signInGoogle(options?: SignInGoogleOptions): Promise<boolean>;
  signOut(): Promise<void>;
  /** RPC `delete_my_data` rồi đăng xuất. Quản trị viên duy nhất bị chặn (không xoá gì). */
  deleteMyData(): Promise<DeleteDataResult>;
  /**
   * Đồng bộ tên + nhân vật lên `profiles` (chỉ khi đã có phiên và đúng hồ sơ đang dùng trên máy;
   * trùng lần trước thì bỏ qua). Phiên Google: phải kéo được hồ sơ tài khoản về trước (chưa kéo thì
   * thử lại; vẫn lỗi thì KHÔNG đẩy, để lần sau). `edited`: người chơi chủ động đổi tên (Xác nhận ở
   * màn Hồ sơ) → ghi dấu bền trên máy, bản sửa tay thắng ở lần kéo thành công kế tiếp.
   */
  syncProfile(profile: ProfileForAccount, options?: { edited?: boolean }): Promise<void>;
  clearOAuthIssue(): void;
}

/** Supabase tạm dừng / mạng chậm: không chờ quá ngần này rồi coi như lỗi (vẫn chơi được). */
export const DATA_TIMEOUT_MS = 6_000;

/** Đăng xuất: chờ đọc token để ghi `sign_out` tối đa ngần này ms rồi đăng xuất luôn. */
const SIGN_OUT_LOG_WAIT_MS = 1_500;

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
let initializing: Promise<void> | null = null;
let ensuring: Promise<string | null> | null = null;
let lastSynced = "";
/** Tài khoản Google đã kéo hồ sơ về THÀNH CÔNG trong lần tải trang này (đăng xuất thì kéo lại). */
let pulledOk: string | null = null;
/** Lần kéo đang chạy (theo tài khoản). */
let pulling: { userId: string; run: Promise<void> } | null = null;

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

function redirectTo(flow: OAuthFlow, returnTo: OAuthReturnTarget = "account") {
  // Quay về trang gốc (URL Configuration của Supabase cho phép `<origin>/**`), rồi mở lại màn Tài khoản;
  // đi từ trang quản trị thì quay về thẳng `/admin`.
  safeSession.set(STORAGE_KEYS.oauthReturn, returnTo);
  safeSession.set(STORAGE_KEYS.oauthFlow, flow);
  return returnTo === "admin" ? `${location.origin}${ADMIN_PATH}` : `${location.origin}/`;
}

function forgetOAuthMarks() {
  safeSession.remove(STORAGE_KEYS.oauthReturn);
  safeSession.remove(STORAGE_KEYS.oauthFlow);
}

/** Đọc một lần rồi xoá dấu luồng Google (đặt trước khi chuyển sang trang Google). */
function takeOAuthFlow(): OAuthFlow | null {
  const flow = safeSession.get(STORAGE_KEYS.oauthFlow);
  safeSession.remove(STORAGE_KEYS.oauthFlow);
  return flow === "link" || flow === "signin" ? flow : null;
}

/**
 * Ghi một sự kiện đăng nhập (RPC `log_login`, CR-019) kèm "trình duyệt · hệ điều hành". Không chờ,
 * lỗi thì bỏ qua: không bao giờ chặn luồng đăng nhập. `accessToken` gắn sẵn token của phiên (dùng
 * khi đăng xuất: yêu cầu có thể đi sau lúc phiên trên máy đã bị xoá).
 */
function logLogin(event: LoginEvent, accessToken?: string) {
  void (async () => {
    try {
      const sb = await client();
      if (!sb) return;
      const call = sb.rpc("log_login", { p_event: event, p_device: currentDeviceLabel() });
      if (accessToken) call.setHeader("Authorization", `Bearer ${accessToken}`);
      const { error } = await withTimeout(Promise.resolve(call));
      if (error) throw error;
    } catch (err) {
      console.warn("[auth] Không ghi được sự kiện đăng nhập:", err);
    }
  })();
}

export const useAuth = create<AuthStore>((set, get) => ({
  status: SUPABASE_CONFIGURED ? "unknown" : "not-configured",
  userId: null,
  email: null,
  oauthIssue: null,

  init() {
    // StrictMode chạy effect hai lần: lần sau dùng chung lần đầu, không ghi trùng sự kiện và không
    // đọc lại URL / dấu luồng Google (lần đầu đã xoá dấu, đọc lại sẽ ghi nhầm `google_sign_in`).
    initializing ??= (async () => {
      if (!SUPABASE_CONFIGURED) return;
      const back = parseOAuthReturn(location.href);
      const flow = takeOAuthFlow();
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
      try {
        const sb = await client();
        if (!sb) return set({ status: "signed-out" });
        const { data } = await withTimeout(sb.auth.getSession());
        set(statusOf(data.session));
        // Lịch sử đăng nhập (CR-019): quay về từ Google với phiên Google mới đổi từ `code`, hoặc mở
        // lại app khi đã có phiên (server bỏ qua nếu đã có sự kiện trong 30 phút).
        const session = data.session;
        if (session && back.hasCode && !back.error && !session.user.is_anonymous) {
          logLogin(flow === "link" ? "google_linked" : "google_sign_in");
        } else if (session && !back.hasCode) {
          logLogin("session_resumed");
        }
      } catch (err) {
        console.warn("[auth] Không đọc được phiên:", err);
        set({ status: "signed-out" });
      }
    })();
    return initializing;
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
          if (session) logLogin("guest_created");
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
        options: { redirectTo: redirectTo("link") },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      forgetOAuthMarks();
      console.warn("[auth] Không liên kết được Google:", err);
      return false;
    }
  },

  async signInGoogle(options = {}) {
    try {
      const sb = await client();
      if (!sb) return false;
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo("signin", options.returnTo),
          ...(options.selectAccount ? { queryParams: { prompt: "select_account" } } : {}),
        },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      forgetOAuthMarks();
      console.warn("[auth] Không đăng nhập được Google:", err);
      return false;
    }
  },

  async signOut() {
    lastSynced = "";
    // Giữ tên trên máy (khách vẫn chơi được); đăng nhập lại thì kéo hồ sơ tài khoản về lần nữa.
    pulledOk = null;
    pulling = null;
    try {
      const sb = await client();
      // Ghi `sign_out` bằng token của phiên sắp bỏ (không chờ kết quả, lỗi bỏ qua). Đọc phiên có thể
      // phải làm mới token qua mạng nên chỉ đợi ngắn, quá thì bỏ qua sự kiện.
      if (sb) {
        const token = await withTimeout(sb.auth.getSession(), SIGN_OUT_LOG_WAIT_MS)
          .then(({ data }) => data.session?.access_token)
          .catch(() => undefined);
        if (token) logLogin("sign_out", token);
      }
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
      if (!sb) return "failed";
      const { error } = await withTimeout(Promise.resolve(sb.rpc("delete_my_data")));
      // Quản trị viên duy nhất: không phải lỗi mạng, giữ phiên để người dùng thêm admin khác.
      if (error?.message === "last-admin") return "last-admin";
      if (error) throw error;
    } catch (err) {
      console.warn("[auth] Không xoá được dữ liệu:", err);
      return "failed";
    }
    await get().signOut();
    return "deleted";
  },

  async syncProfile(profile, options = {}) {
    const start = get();
    if (options.edited) {
      // Đang đăng nhập Google → nhớ "đã sửa tay cho tài khoản này, chưa đẩy". Khách / chưa đăng
      // nhập → hồ sơ trên máy thôi gắn tài khoản cũ (đăng nhập tài khoản mới chưa có tên thì đẩy lên).
      if (start.status === "google" && start.userId) setProfileMeta({ editedFor: start.userId });
      else setProfileMeta({ owner: null, editedFor: null });
    }
    const userId = start.userId;
    if (!userId) return;
    const google = start.status === "google";
    // Chưa biết tên trên tài khoản thì không đẩy: kéo về (hoặc chờ lần đang kéo) trước; lỗi → để sau.
    if (google && !(await ensurePulled(userId))) return;
    if (get().userId !== userId) return;
    const name = profile.name.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return;
    // Chỉ đẩy đúng hồ sơ đang dùng trên máy: giá trị cũ (màn mở trước khi hồ sơ tài khoản về tới,
    // hay hồ sơ của tài khoản trước trên máy này) không được đè tên của tài khoản.
    const current = useProfile.getState().profile;
    if (current.name !== name || current.avatar !== profile.avatar) return;
    const key = `${userId}|${name}|${profile.avatar}`;
    if (key === lastSynced) return;
    lastSynced = key;
    try {
      const sb = await client();
      if (!sb) throw new Error("no-client");
      const { error } = await withTimeout(
        Promise.resolve(
          sb.from("profiles").upsert({ id: userId, display_name: name, avatar: profile.avatar }),
        ),
      );
      if (error) throw error;
      if (google) {
        // Đã lên tài khoản: hồ sơ trên máy theo tài khoản này, bỏ dấu sửa tay.
        const { editedFor } = profileMeta();
        setProfileMeta({ owner: userId, editedFor: editedFor === userId ? null : editedFor });
      }
    } catch (err) {
      lastSynced = "";
      console.warn("[auth] Không đồng bộ được hồ sơ:", err);
    }
  },

  clearOAuthIssue: () => set({ oauthIssue: null }),
}));

/**
 * Kéo tên + nhân vật của tài khoản Google (hàng `profiles` của chính mình, RLS cho đọc) về hồ sơ
 * trên máy rồi hợp nhất bằng `mergeAccountProfile`. Thành công thì một lần cho mỗi tài khoản mỗi lần
 * tải trang; lỗi mạng / Supabase tạm dừng / quá giờ → chỉ cảnh báo, lần `syncProfile` sau kéo lại.
 */
function pullAccountProfile(userId: string): Promise<void> {
  if (pulledOk === userId) return Promise.resolve();
  if (pulling?.userId === userId) return pulling.run;
  const before = useProfile.getState().profile;
  const run = (async () => {
    try {
      const sb = await client();
      if (!sb) throw new Error("no-client");
      const { data, error } = await withTimeout(
        Promise.resolve(
          sb.from("profiles").select("display_name, avatar").eq("id", userId).maybeSingle(),
        ),
      );
      if (error) throw error;
      // Đổi tài khoản trong lúc chờ → bỏ, lần kéo của tài khoản mới tự lo.
      if (useAuth.getState().userId !== userId) return;
      const local = useProfile.getState().profile;
      const meta = profileMeta();
      // Bản sửa tay chưa đẩy (dấu bền), hoặc vừa sửa tên / nhân vật trong lúc chờ → bản trên máy thắng.
      const edited =
        meta.editedFor === userId || local.name !== before.name || local.avatar !== before.avatar;
      const merged = mergeAccountProfile(local, data, { userId, owner: meta.owner, edited });
      pulledOk = userId;
      if (merged.changed) adoptAccountProfile(merged.profile, userId);
      else if (!merged.push) setProfileMeta({ owner: userId });
      // Không chờ: `syncProfile` chờ chính lần kéo này xong.
      if (merged.push) void useAuth.getState().syncProfile(merged.profile);
    } catch (err) {
      console.warn("[auth] Không đọc được hồ sơ tài khoản:", err);
    }
  })();
  const entry = { userId, run };
  pulling = entry;
  void run.finally(() => {
    if (pulling === entry) pulling = null;
  });
  return run;
}

/** Đã có hồ sơ tài khoản (kéo về được) chưa; chưa thì kéo / chờ lần đang kéo. */
async function ensurePulled(userId: string): Promise<boolean> {
  await pullAccountProfile(userId);
  return pulledOk === userId;
}

// Có phiên Google (đọc phiên lúc mở app, quay về từ Google, đổi sang tài khoản khác) → kéo hồ sơ về.
useAuth.subscribe((s, prev) => {
  if (s.status !== "google" || !s.userId) return;
  if (s.userId !== prev.userId || prev.status !== "google") void pullAccountProfile(s.userId);
});

/**
 * Lần quay về từ Google: mở thẳng màn Tài khoản (đọc một lần rồi xoá dấu). Đi từ trang quản trị thì
 * URL đã là `/admin` nên trả `false` (nav tự mở trang quản trị theo đường dẫn).
 */
export function takeOAuthReturnScreen(): boolean {
  const marked = safeSession.get(STORAGE_KEYS.oauthReturn) === "account";
  safeSession.remove(STORAGE_KEYS.oauthReturn);
  return marked;
}
