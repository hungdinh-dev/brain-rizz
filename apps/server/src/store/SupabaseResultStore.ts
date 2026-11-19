import { randomUUID } from "node:crypto";
import {
  type EarnSource,
  type PartyConfig,
  parsePartyConfig,
  parseUnlockStats,
} from "@brain-rizz/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CosmeticsCache, type CosmeticsWant } from "./cosmetics-cache";
import type {
  BrainTestRecord,
  CosmeticsRecord,
  MatchResultRecord,
  ResultStore,
} from "./ResultStore";

/** Mỗi lần gọi Supabase tối đa ngần này ms (dự án Free bị tạm dừng thì không treo phòng). */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Ghi kết quả lên Supabase bằng khoá secret (`sb_secret_…` hoặc service_role kiểu cũ),
 * nên bỏ qua RLS. Khoá này chỉ nằm trên game server (NFR-SEC-03).
 * Bảng và cột: `supabase/migrations/20261016000000_accounts.sql`, hợp đồng ở ADR 0011.
 * Phấn / phụ kiện / thành tích (CR-023, CR-024): RPC `unlock_stats_for`, `grant_chalk` và bảng
 * `user_items` ở `supabase/migrations/20261120000000_gacha.sql` (hợp đồng: kế hoạch
 * `docs/01-product/gacha-pets-unlocks.md` mục 5.3).
 */
export class SupabaseResultStore implements ResultStore {
  readonly enabled = true;
  private readonly db: SupabaseClient;
  /** Đệm quyền đồ trang trí 60 giây theo người (xin món đệm chưa có → đọc lại, ≤ 1 lần / 5 giây). */
  private readonly cosmetics = new CosmeticsCache((userId) => this.fetchCosmetics(userId));

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
      },
    });
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      // getClaims kiểm chữ ký bằng JWKS của dự án (khoá bất đối xứng), hoặc hỏi Auth server
      // (khoá HS256 kiểu cũ); kiểm cả hạn dùng.
      const { data, error } = await this.db.auth.getClaims(token);
      if (error || !data) return null;
      const { sub, role } = data.claims;
      // Phiên khách ẩn danh cũng có role `authenticated`; khoá publishable/anon (role `anon`) thì không.
      if (role !== "authenticated" || typeof sub !== "string" || sub === "") return null;
      return sub;
    } catch (err) {
      console.warn("[store] Không xác thực được token:", errorMessage(err));
      return null;
    }
  }

  async saveBrainTest(record: BrainTestRecord): Promise<string> {
    const id = randomUUID();
    const { error } = await this.db.from("brain_tests").insert({
      id,
      user_id: record.userId,
      brain_score: Math.round(record.brainScore),
      difficulty: record.difficulty,
      rules_version: record.rulesVersion,
      skills: record.skills,
    });
    if (error) throw new Error(`brain_tests: ${error.message}`);

    const games = record.games.map((g) => ({
      brain_test_id: id,
      user_id: record.userId,
      game_id: g.gameId,
      category: g.category,
      score: Math.round(g.score),
      correct: g.correct,
    }));
    const { error: gamesError } = await this.db.from("brain_test_games").insert(games);
    if (gamesError) {
      // Không để lại lượt thiếu điểm từng game: xoá dòng cha (bảng con xoá theo cascade).
      await this.db.from("brain_tests").delete().eq("id", id);
      throw new Error(`brain_test_games: ${gamesError.message}`);
    }
    // Kỷ lục Điểm Não có thể vừa đổi (luật mở thú `brain-score`): lần sau đọc lại thành tích.
    this.cosmetics.invalidate(record.userId);
    return id;
  }

  async saveMatchResults(rows: readonly MatchResultRecord[]): Promise<string> {
    if (rows.length === 0) return "";
    const { data, error } = await this.db
      .from("match_results")
      .insert(
        rows.map((r) => ({
          user_id: r.userId,
          room_code: r.roomCode,
          placement: r.placement,
          players: r.players,
          match_points: r.matchPoints,
          total_score: r.totalScore,
          rounds: r.rounds,
          games: r.games,
          // Cột thêm ở migration 20261019000000_match_category_scores.sql (CR-010).
          category_scores: r.categoryScores,
          category_titles: r.categoryTitles,
          // Cột thêm ở migration 20261021000000_match_bot_count.sql (CR-016).
          bot_count: r.botCount,
          // Cột thêm ở migration 20261119000000_admin_console.sql (CR-019).
          settings_version: r.settingsVersion,
        })),
      )
      // Mọi dòng của một lệnh insert có cùng `created_at` (`now()` = giờ bắt đầu giao dịch).
      .select("created_at");
    if (error) throw new Error(`match_results: ${error.message}`);
    // Số trận / thắng / điểm nhóm vừa đổi (luật mở thú party): lần sau đọc lại thành tích.
    for (const r of rows) this.cosmetics.invalidate(r.userId);
    const createdAt = (data as { created_at?: unknown }[] | null)?.[0]?.created_at;
    // Không đọc được giờ ghi (không nên xảy ra) → mã ngẫu nhiên, vẫn riêng cho trận này.
    return typeof createdAt === "string" && createdAt !== "" ? createdAt : randomUUID();
  }

  loadCosmetics(userId: string, want?: CosmeticsWant): Promise<CosmeticsRecord | null> {
    return this.cosmetics.get(userId, want);
  }

  /** Đọc thật (không đệm): `unlock_stats_for` + `user_items`. Lỗi → `null`, không ném. */
  private async fetchCosmetics(userId: string): Promise<CosmeticsRecord | null> {
    try {
      const [stats, items] = await Promise.all([
        this.db.rpc("unlock_stats_for", { p_user: userId }),
        this.db.from("user_items").select("item_id").eq("user_id", userId),
      ]);
      if (stats.error || items.error) {
        console.warn(
          "[store] Không đọc được phụ kiện / thành tích:",
          stats.error?.message ?? items.error?.message,
        );
        return null;
      }
      const owned: string[] = [];
      for (const row of (items.data ?? []) as { item_id?: unknown }[]) {
        if (typeof row.item_id === "string") owned.push(row.item_id);
      }
      // Không tin DB: parseUnlockStats không bao giờ ném, số sai → 0.
      return { stats: parseUnlockStats(stats.data), items: owned };
    } catch (err) {
      console.warn("[store] Không đọc được phụ kiện / thành tích:", errorMessage(err));
      return null;
    }
  }

  async grantChalk(
    userId: string,
    source: EarnSource,
    ref: string,
    amount: number,
  ): Promise<number | null> {
    const want = Number.isFinite(amount) ? Math.trunc(amount) : 0;
    if (want <= 0) return 0;
    try {
      const { data, error } = await this.db.rpc("grant_chalk", {
        p_user: userId,
        p_source: source,
        p_ref: ref,
        p_amount: want,
      });
      if (error) {
        console.warn(`[store] Không cộng được phấn (${source}):`, error.message);
        return null;
      }
      // `null` / chuỗi lạ (không nên xảy ra) → không biết đã cộng bao nhiêu: coi như lỗi.
      const granted = data === null ? Number.NaN : Number(data);
      if (!Number.isFinite(granted)) {
        console.warn(`[store] grant_chalk (${source}) trả về giá trị lạ:`, data);
        return null;
      }
      return granted > 0 ? Math.trunc(granted) : 0;
    } catch (err) {
      console.warn(`[store] Không cộng được phấn (${source}):`, errorMessage(err));
      return null;
    }
  }

  async loadPartyConfig(): Promise<PartyConfig | null> {
    try {
      const { data, error } = await this.db
        .from("party_settings")
        .select("version, scoring, disabled_games")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        console.warn("[store] Không đọc được party_settings:", error.message);
        return null;
      }
      if (!data) return null;
      // Không tin DB: sai trường nào về mặc định trường đó (parsePartyConfig không bao giờ ném).
      return parsePartyConfig({
        version: data.version,
        scoring: data.scoring,
        disabledGames: data.disabled_games,
      });
    } catch (err) {
      console.warn("[store] Không đọc được party_settings:", errorMessage(err));
      return null;
    }
  }

  async isAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.db
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[store] Không kiểm được quyền quản trị:", error.message);
        return false;
      }
      return data !== null;
    } catch (err) {
      console.warn("[store] Không kiểm được quyền quản trị:", errorMessage(err));
      return false;
    }
  }
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
