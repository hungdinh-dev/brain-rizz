import { GAME_IDS, type GameId } from "@brain-rizz/shared";
import { SUPABASE_CONFIGURED } from "./supabase";

/**
 * Game đang bật theo cấu hình của quản trị viên (CR-019, `party_settings.disabled_games`), để
 * Luyện tập ẩn game bị tắt giống trận party.
 *
 * - Đọc qua RPC công khai `party_disabled_games` (migration 20261121000000) bằng `fetch` thường tới
 *   REST của Supabase với khoá publishable: không cần phiên, không phải tải supabase-js cho khách.
 * - Cùng luật với server (`parsePartyConfig` bỏ id lạ, `enabledGameIds` trả cả danh mục khi còn
 *   < 2 game bật) nhưng viết lại ở đây: import `party-config.ts` kéo zod vào gói JS ban đầu (thẻ
 *   Luyện tập ở menu dùng file này). `enabled-games.test.ts` đối chiếu với hai hàm của shared.
 * - Không bao giờ chặn màn hình: trước khi tải xong, chưa cấu hình Supabase, lỗi mạng, quá giờ hay
 *   DB chưa có hàm → giữ kết quả lần trước, chưa có thì đủ danh mục (`GAME_IDS`).
 * - Đệm trong bộ nhớ `ENABLED_GAMES_TTL_MS`; nhiều nơi hỏi cùng lúc chỉ gọi một lần. Lỗi thì không
 *   đệm: lần mở màn sau thử lại.
 */

export const ENABLED_GAMES_TTL_MS = 5 * 60_000;
export const ENABLED_GAMES_TIMEOUT_MS = 5_000;

const ALL_GAMES: readonly GameId[] = GAME_IDS;

/** Dữ liệu thô của RPC → game đang bật; sai dạng (không phải mảng) → `null` (coi như lỗi). */
export function enabledFromDisabledList(data: unknown): GameId[] | null {
  if (!Array.isArray(data)) return null;
  const off = new Set(data.filter((v): v is string => typeof v === "string"));
  const enabled = GAME_IDS.filter((id) => !off.has(id));
  return enabled.length < 2 ? [...GAME_IDS] : enabled;
}

/**
 * Gọi `GET <url>/rest/v1/rpc/party_disabled_games`. Khoá publishable mới (`sb_publishable_…`) chỉ
 * gửi ở `apikey`; anon key kiểu cũ (JWT) gửi thêm `Authorization` như supabase-js. HTTP lỗi → ném.
 */
export async function fetchDisabledGames(
  url: string,
  key: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetcher(`${url.replace(/\/+$/, "")}/rest/v1/rpc/party_disabled_games`, {
    headers,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface EnabledGamesOptions {
  /** Lấy danh sách game tắt (thô). `null` = chưa cấu hình máy chủ dữ liệu: luôn đủ danh mục. */
  fetchDisabled: ((signal: AbortSignal) => Promise<unknown>) | null;
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

export interface EnabledGamesCache {
  /** Danh sách hiện tại (theo thứ tự `GAME_IDS`); đổi tham chiếu chỉ khi nội dung đổi. */
  get(): readonly GameId[];
  subscribe(listener: () => void): () => void;
  /** Tải lại nếu đệm đã hết hạn. Không bao giờ reject; trả danh sách sau khi xong. */
  refresh(): Promise<readonly GameId[]>;
}

export function createEnabledGames({
  fetchDisabled,
  ttlMs = ENABLED_GAMES_TTL_MS,
  timeoutMs = ENABLED_GAMES_TIMEOUT_MS,
  now = Date.now,
}: EnabledGamesOptions): EnabledGamesCache {
  let current = ALL_GAMES;
  let fetchedAt: number | null = null;
  let pending: Promise<readonly GameId[]> | null = null;
  const listeners = new Set<() => void>();

  const update = (next: readonly GameId[]) => {
    if (next.length === current.length && next.every((id, i) => id === current[i])) return;
    current = next;
    for (const listener of listeners) listener();
  };

  const load = async (): Promise<readonly GameId[]> => {
    if (!fetchDisabled) return current;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    try {
      const ids = enabledFromDisabledList(
        await Promise.race([fetchDisabled(controller.signal), timeout]),
      );
      if (ids) {
        fetchedAt = now();
        update(ids);
      }
    } catch (err) {
      console.warn("[enabled-games] Không tải được danh sách game tắt:", err);
    } finally {
      clearTimeout(timer);
    }
    return current;
  };

  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (pending) return pending;
      if (fetchedAt !== null && now() - fetchedAt < ttlMs) return Promise.resolve(current);
      pending = load().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}

const URL_ENV = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const KEY_ENV = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

/** Bản dùng chung của web. */
export const enabledGames: EnabledGamesCache = createEnabledGames({
  fetchDisabled: SUPABASE_CONFIGURED
    ? (signal) => fetchDisabledGames(URL_ENV, KEY_ENV, signal)
    : null,
});
