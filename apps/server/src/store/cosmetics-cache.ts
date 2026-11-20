import type { CosmeticsRecord } from "./ResultStore";

/** Giữ quyền phụ kiện / thú của một người ngần này ms trước khi đọc lại DB (CR-023, CR-024). */
export const COSMETICS_TTL_MS = 60_000;
/**
 * Người chơi xin món / thú mà bản đệm chưa cho phép (vừa quay gacha, vừa mở thú) → đọc lại DB bỏ qua
 * đệm, nhưng chỉ khi lần đọc DB gần nhất của người đó đã cách ít nhất ngần này ms (chống dồn).
 */
export const COSMETICS_REFRESH_MS = 5_000;
/** Quá ngần này người trong đệm thì dọn bản hết hạn, rồi bỏ bản cũ nhất (giữ RAM có hạn). */
export const COSMETICS_CACHE_MAX = 2_000;

/** Yêu cầu của phòng khi nạp quyền cho một bộ đồ người chơi đang xin. */
export interface CosmeticsWant {
  /** Bản đệm có đủ cho yêu cầu không (vd. có món người chơi vừa xin). */
  isEnough: (owned: CosmeticsRecord) => boolean;
  /**
   * Bản đệm không đủ nhưng chưa được đọc lại (lần đọc DB gần nhất chưa quá `COSMETICS_REFRESH_MS`):
   * gọi ngay, trước khi trả bản đệm, với số ms còn lại tới khi được đọc lại (phòng hẹn đọc lại).
   */
  onDeferred?: (retryInMs: number) => void;
}

interface Entry {
  value: CosmeticsRecord;
  /** Lúc đọc xong bản này (tính hạn `ttlMs`). */
  fetchedAt: number;
  /** Lúc bắt đầu lần đọc DB gần nhất của người này, kể cả lượt đọc lại bị lỗi (chống dồn). */
  checkedAt: number;
}

/**
 * Bộ đệm `loadCosmetics` theo người (dùng trong `SupabaseResultStore`):
 * - Còn hạn (`COSMETICS_TTL_MS` kể từ lần đọc xong) → trả ngay, không gọi DB.
 * - Còn hạn nhưng không qua `want.isEnough` (người chơi xin món / thú bản đệm chưa có, kế hoạch gacha
 *   mục 5.2) → đọc lại DB bỏ qua đệm. Chống dồn: đang có lượt đọc thì đợi lượt đó; lần đọc gần nhất
 *   chưa quá `COSMETICS_REFRESH_MS` thì báo `want.onDeferred` và trả bản đệm. Đọc lại lỗi → trả bản
 *   đệm cũ.
 * - Nhiều phòng hỏi cùng một người cùng lúc → chỉ đọc một lần.
 * - Đọc ra `null` (lỗi) → không đệm, lần sau đọc lại; trả `null` (phòng giữ quy tắc an toàn).
 * - `invalidate(userId)`: bỏ đệm của người đó (vừa ghi trận / Kiểm tra não → thành tích đổi);
 *   lượt đọc đang chạy lúc đó (có thể là bản cũ) vẫn trả cho người hỏi nhưng không được ghi đệm.
 * Không bao giờ ném.
 */
export class CosmeticsCache {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<CosmeticsRecord | null>>();

  constructor(
    private readonly load: (userId: string) => Promise<CosmeticsRecord | null>,
    private readonly ttlMs = COSMETICS_TTL_MS,
    private readonly now: () => number = () => Date.now(),
    private readonly maxEntries = COSMETICS_CACHE_MAX,
    private readonly refreshMs = COSMETICS_REFRESH_MS,
  ) {}

  get(userId: string, want?: CosmeticsWant): Promise<CosmeticsRecord | null> {
    const now = this.now();
    const hit = this.entries.get(userId);
    const running = this.inflight.get(userId);
    if (hit && now - hit.fetchedAt < this.ttlMs) {
      if (!want || want.isEnough(hit.value)) return Promise.resolve(hit.value);
      // Bản đệm thiếu món / thú đang xin: đọc lại, trừ khi vừa đọc (hoặc đang đọc) gần đây.
      if (running) return running;
      const sinceCheck = now - hit.checkedAt;
      if (sinceCheck < this.refreshMs) {
        want.onDeferred?.(this.refreshMs - sinceCheck);
        return Promise.resolve(hit.value);
      }
      hit.checkedAt = now;
      return this.start(userId, hit.value);
    }
    return running ?? this.start(userId, null);
  }

  invalidate(userId: string) {
    this.entries.delete(userId);
    this.inflight.delete(userId);
  }

  /** Số người đang có trong đệm (cho test). */
  get size() {
    return this.entries.size;
  }

  /** Đọc DB một lượt; lỗi thì trả `fallback` (bản đệm cũ khi đọc lại, `null` khi đọc thường). */
  private start(userId: string, fallback: CosmeticsRecord | null): Promise<CosmeticsRecord | null> {
    const task: Promise<CosmeticsRecord | null> = Promise.resolve()
      .then(() => this.load(userId))
      .catch((err: unknown) => {
        console.warn("[cosmetics] Không nạp được phụ kiện / thành tích:", err);
        return null;
      })
      .then((value) => {
        // Bị `invalidate` trong lúc đọc thì lượt này không còn trong `inflight`: không ghi đệm.
        if (this.inflight.get(userId) === task) {
          this.inflight.delete(userId);
          if (value) {
            const at = this.now();
            this.entries.delete(userId);
            this.entries.set(userId, { value, fetchedAt: at, checkedAt: at });
            this.prune();
          }
        }
        return value ?? fallback;
      });
    this.inflight.set(userId, task);
    return task;
  }

  private prune() {
    if (this.entries.size <= this.maxEntries) return;
    const now = this.now();
    for (const [id, entry] of this.entries) {
      if (now - entry.fetchedAt >= this.ttlMs) this.entries.delete(id);
    }
    // Map giữ thứ tự chèn (bản vừa đọc được chèn lại ở cuối): bỏ bản cũ nhất.
    for (const id of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(id);
    }
  }
}
