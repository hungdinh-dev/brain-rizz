import { DEFAULT_PARTY_CONFIG, type PartyConfig } from "@brain-rizz/shared";
import { getResultStore, type ResultStore } from "./ResultStore";

/** Giữ cấu hình party trong tiến trình ngần này ms trước khi đọc lại DB (CR-019). */
export const PARTY_CONFIG_TTL_MS = 30_000;
/**
 * Phòng chờ cấu hình tối đa ngần này ms (lúc tạo phòng, bắt đầu trận). Quá hạn thì dùng bản đang
 * có và để lượt đọc chạy nền: Supabase bị tạm dừng (timeout 8 giây) không làm treo nút Bắt đầu.
 */
export const PARTY_CONFIG_WAIT_MS = 2_000;

/**
 * Bộ đệm cấu hình party của một `ResultStore`:
 * - Còn hạn (`PARTY_CONFIG_TTL_MS` kể từ lần đọc xong gần nhất) → trả ngay, không gọi DB.
 * - Hết hạn → đọc lại (`loadPartyConfig`); nhiều phòng hỏi cùng lúc chỉ đọc một lần.
 * - Đọc ra `null` (chưa có dòng, lỗi, bản rỗng) → giữ bản đã có, chưa có thì `DEFAULT_PARTY_CONFIG`.
 *   Lỗi cũng được đệm như một lần đọc, để DB hỏng không bị gọi lại liên tục.
 * - `invalidate()` (admin vừa lưu): bỏ đệm; lượt đọc đang chạy (có thể là bản cũ) bị bỏ qua.
 */
export class PartyConfigCache {
  /** Bản đọc được gần nhất (giữ khi lần đọc sau ra `null`). */
  private last: PartyConfig | null = null;
  private fetchedAt = Number.NEGATIVE_INFINITY;
  private inflight: Promise<PartyConfig> | null = null;
  /** Tăng mỗi lần `invalidate`: lượt đọc của thế hệ cũ không được ghi đè đệm. */
  private generation = 0;

  constructor(
    readonly store: ResultStore,
    private readonly ttlMs = PARTY_CONFIG_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Cấu hình hiện có, không gọi DB (chưa đọc lần nào thì mặc định). */
  peek(): PartyConfig {
    return this.last ?? DEFAULT_PARTY_CONFIG;
  }

  /**
   * Cấu hình còn hạn, hoặc đọc lại. `maxWaitMs`: chờ tối đa ngần này ms rồi trả `peek()`, lượt
   * đọc vẫn chạy tiếp và cập nhật đệm cho lần hỏi sau. Không bao giờ ném.
   */
  async get(maxWaitMs?: number): Promise<PartyConfig> {
    if (this.now() - this.fetchedAt < this.ttlMs) return this.peek();
    const loading = this.refresh();
    if (maxWaitMs === undefined) return loading;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<PartyConfig>((resolve) => {
      timer = setTimeout(() => resolve(this.peek()), maxWaitMs);
      timer.unref?.();
    });
    try {
      return await Promise.race([loading, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Bỏ đệm (admin vừa lưu cấu hình); lần hỏi sau đọc lại DB. */
  invalidate() {
    this.generation++;
    this.fetchedAt = Number.NEGATIVE_INFINITY;
    this.inflight = null;
  }

  /** Bỏ đệm rồi đọc lại ngay; trả cấu hình sau khi đọc (lỗi → bản đang có). */
  reload(): Promise<PartyConfig> {
    this.invalidate();
    return this.refresh();
  }

  private refresh(): Promise<PartyConfig> {
    if (this.inflight) return this.inflight;
    const generation = this.generation;
    const task = this.store
      .loadPartyConfig()
      .catch((err: unknown) => {
        console.warn("[config] Không nạp được cấu hình party:", err);
        return null;
      })
      .then((loaded) => {
        if (generation === this.generation) {
          if (loaded) this.last = loaded;
          this.fetchedAt = this.now();
          this.inflight = null;
        }
        return loaded ?? this.peek();
      });
    this.inflight = task;
    return task;
  }
}

let cache: PartyConfigCache | null = null;

/** Bộ đệm dùng chung của tiến trình, gắn với store hiện tại (`setResultStore` đổi store thì đệm mới). */
export function partyConfigCache(): PartyConfigCache {
  const store = getResultStore();
  if (!cache || cache.store !== store) cache = new PartyConfigCache(store);
  return cache;
}

/** Cấu hình party cho phòng (đệm 30 giây, chờ tối đa `PARTY_CONFIG_WAIT_MS`). Không bao giờ ném. */
export function getPartyConfig(maxWaitMs = PARTY_CONFIG_WAIT_MS): Promise<PartyConfig> {
  return partyConfigCache().get(maxWaitMs);
}

/** Xoá bộ đệm cấu hình party: trận bắt đầu sau lời gọi này đọc lại DB. */
export function invalidatePartyConfig() {
  partyConfigCache().invalidate();
}
