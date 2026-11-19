import { parseUnlockStats, type UnlockStats } from "@brain-rizz/shared";
import { hasStoredSession, loadSupabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { withTimeout } from "@/stores/auth.store";
import type { DataResult } from "./data-api";

/**
 * Số liệu mở khoá bạn đồng hành của mình (CR-024, gacha-pets-unlocks.md mục 5.3): RPC
 * `my_unlock_stats()` → `parseUnlockStats`. Server mới là nơi quyết thú nào được dùng trong phòng;
 * số liệu này chỉ để hiện khoá, điều kiện và thanh tiến độ.
 *
 * Không bao giờ ném lỗi. Không tạo phiên khách mới: chưa có phiên thì chưa có gì trên máy chủ
 * (`no-session`, màn hình coi như chưa chơi gì).
 */

/**
 * DB chưa có hàm (chưa chạy migration `gacha`: 404 / PGRST202) → thôi gọi tới khi tải lại trang;
 * màn hình hiện thú khoá với "chưa có dữ liệu", không báo lỗi.
 */
let unlockStatsMissing = false;

/** Cho test: quên lần báo "chưa có hàm" trước đó. */
export function resetUnlockStatsAvailability() {
  unlockStatsMissing = false;
}

function isMissingRpc(error: unknown, status: number | undefined): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "PGRST202" || status === 404;
}

export async function fetchUnlockStats(): Promise<DataResult<UnlockStats>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, reason: "not-configured" };
  if (unlockStatsMissing) return { ok: false, reason: "error" };
  if (!hasStoredSession()) return { ok: false, reason: "no-session" };
  try {
    const sb = await withTimeout(loadSupabase());
    if (!sb) return { ok: false, reason: "not-configured" };
    // Phiên còn trên máy nhưng có thể đã bị đăng xuất ở tab khác.
    const { data: auth } = await withTimeout(sb.auth.getSession());
    if (!auth.session) return { ok: false, reason: "no-session" };
    const res: { data: unknown; error: unknown; status?: number } = await withTimeout(
      Promise.resolve(sb.rpc("my_unlock_stats")),
    );
    if (res.error) {
      if (isMissingRpc(res.error, res.status)) {
        unlockStatsMissing = true;
        return { ok: false, reason: "error" };
      }
      throw res.error;
    }
    return { ok: true, data: parseUnlockStats(res.data) };
  } catch (err) {
    console.warn("[data] Không tải được tiến độ mở khoá:", err);
    return { ok: false, reason: "error" };
  }
}
