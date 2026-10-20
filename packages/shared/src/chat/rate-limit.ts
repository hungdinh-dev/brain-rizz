import { CHAT_RATE } from "./constants";

/**
 * Giới hạn tần suất chat mỗi người (token bucket, CR-011): gửi liền tối đa `burst` tin,
 * sau đó hồi một tin mỗi `refillMs`. Hàm thuần để server dùng và test được bằng giờ giả.
 * Lượt được tính bằng "ms tín dụng" (một tin = `refillMs`) để không lệch số thực.
 */

export interface ChatRate {
  burst: number;
  refillMs: number;
}

export interface ChatBucket {
  /** Tín dụng còn lại theo ms; mỗi tin tốn `refillMs`, tối đa `burst * refillMs`. */
  creditMs: number;
  /** Thời điểm tính `creditMs` (ms). */
  at: number;
}

/**
 * Thử lấy một lượt gửi tại thời điểm `nowMs`. `bucket` chưa có (người mới) thì coi như đầy.
 * Bị từ chối không trừ lượt, chỉ cập nhật phần đã hồi. Giờ lùi không cộng thêm lượt.
 */
export function consumeToken(
  bucket: ChatBucket | undefined,
  nowMs: number,
  rate: ChatRate = CHAT_RATE,
): { ok: boolean; bucket: ChatBucket } {
  const full = rate.burst * rate.refillMs;
  const prev = bucket ?? { creditMs: full, at: nowMs };
  const at = Math.max(prev.at, nowMs);
  const creditMs = Math.min(full, prev.creditMs + (at - prev.at));
  if (creditMs < rate.refillMs) return { ok: false, bucket: { creditMs, at } };
  return { ok: true, bucket: { creditMs: creditMs - rate.refillMs, at } };
}

export interface ChatRateLimiter {
  /** `true` nếu người `id` được gửi lúc `nowMs` (và trừ một lượt). */
  consume(id: string, nowMs: number): boolean;
  /** Xoá trạng thái của người đã rời phòng. */
  forget(id: string): void;
}

export function createChatRateLimiter(rate: ChatRate = CHAT_RATE): ChatRateLimiter {
  const buckets = new Map<string, ChatBucket>();
  return {
    consume(id, nowMs) {
      const { ok, bucket } = consumeToken(buckets.get(id), nowMs, rate);
      buckets.set(id, bucket);
      return ok;
    },
    forget(id) {
      buckets.delete(id);
    },
  };
}
