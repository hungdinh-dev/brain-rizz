import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BrainTestRecord, MatchResultRecord, ResultStore } from "./ResultStore";

/** Mỗi lần gọi Supabase tối đa ngần này ms (dự án Free bị tạm dừng thì không treo phòng). */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Ghi kết quả lên Supabase bằng khoá secret (`sb_secret_…` hoặc service_role kiểu cũ),
 * nên bỏ qua RLS. Khoá này chỉ nằm trên game server (NFR-SEC-03).
 * Bảng và cột: `supabase/migrations/20261016000000_accounts.sql`, hợp đồng ở ADR 0011.
 */
export class SupabaseResultStore implements ResultStore {
  readonly enabled = true;
  private readonly db: SupabaseClient;

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

  async saveBrainTest(record: BrainTestRecord): Promise<void> {
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
  }

  async saveMatchResults(rows: readonly MatchResultRecord[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.db.from("match_results").insert(
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
      })),
    );
    if (error) throw new Error(`match_results: ${error.message}`);
  }
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
