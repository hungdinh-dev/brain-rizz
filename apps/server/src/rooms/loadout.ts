import {
  type CharacterId,
  isBaseCharacterId,
  isCharacterUnlocked,
  sanitizeLoadout,
} from "@brain-rizz/shared";
import type { CosmeticsRecord } from "../store/ResultStore";

/** Nhân vật thay cho thú khoá chưa được dùng (CR-024). */
export const FALLBACK_CHARACTER: CharacterId = "khoi";

/**
 * Hẹn đọc lại quyền khi bản đệm thiếu món / thú đang xin mà còn trong cửa sổ chống dồn
 * (`CosmeticsWant.onDeferred`): chờ thêm ngần này ms sau khi hết cửa sổ, vì đồng hồ phòng tick theo
 * nhịp nên có thể chạy sớm hơn giờ thật một chút.
 */
export const OWNERSHIP_RETRY_MARGIN_MS = 250;

/** Bộ đồ người chơi xin (join options / setProfile), chưa kiểm sở hữu. */
export interface RequestedLoadout {
  avatar: CharacterId;
  accessories: readonly string[];
}

/** Bộ đồ được dùng, đưa vào state. */
export interface ResolvedLoadout {
  avatar: CharacterId;
  accessories: string[];
}

/**
 * Kiểm sở hữu (CR-023, CR-024, kế hoạch gacha mục 5.2). `owned` là quyền đã nạp
 * (`ResultStore.loadCosmetics`); `null` = chưa nạp xong, không có phiên hợp lệ hoặc store lỗi.
 * - 6 nhân vật cũ luôn được.
 * - Thú khoá: được khi đã nạp quyền và `isCharacterUnlocked`; còn lại → `FALLBACK_CHARACTER`.
 * - Phụ kiện: `sanitizeLoadout(ids, món đã có)`; chưa có quyền → không đeo gì.
 * Không bao giờ từ chối: chỉ thay bằng bản an toàn.
 */
export function resolveLoadout(
  requested: RequestedLoadout,
  owned: CosmeticsRecord | null | undefined,
): ResolvedLoadout {
  const avatar =
    isBaseCharacterId(requested.avatar) ||
    (owned != null && isCharacterUnlocked(requested.avatar, owned.stats))
      ? requested.avatar
      : FALLBACK_CHARACTER;
  return {
    avatar,
    accessories: owned ? sanitizeLoadout(requested.accessories, owned.items) : [],
  };
}

/**
 * Quyền `owned` có đủ cho bộ đồ đang xin không: thú khoá đã mở, và mọi phụ kiện sẽ hiện (id có trong
 * danh mục, mỗi chỗ món gặp đầu tiên) đều đã có. Không đủ → `loadCosmetics` đọc lại DB bỏ qua đệm
 * (vừa quay gacha / vừa mở thú, kế hoạch gacha mục 5.2).
 */
export function ownsRequested(requested: RequestedLoadout, owned: CosmeticsRecord): boolean {
  const resolved = resolveLoadout(requested, owned);
  return (
    resolved.avatar === requested.avatar &&
    resolved.accessories.join(",") === sanitizeLoadout(requested.accessories).join(",")
  );
}

/** Cần nạp quyền không: xin thú khoá hoặc có phụ kiện (nhân vật cũ, không phụ kiện thì khỏi nạp). */
export function needsOwnership(requested: RequestedLoadout): boolean {
  return !isBaseCharacterId(requested.avatar) || requested.accessories.length > 0;
}
