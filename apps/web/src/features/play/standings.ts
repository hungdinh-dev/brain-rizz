import { comboMultiplier, type PlayerView, STREAK_THRESHOLD } from "@brain-rizz/shared";

export interface Standing {
  player: PlayerView;
  /** Hạng trong vòng, từ 1. Bằng điểm thì cùng hạng. */
  rank: number;
}

/**
 * Xếp hạng theo điểm vòng (chỉ để hiển thị — điểm do server tính). Bằng điểm thì cùng hạng
 * kiểu thi đấu (1, 2, 2, 4); thứ tự trong nhóm bằng điểm giữ như thứ tự vào phòng.
 */
export function rankByRoundScore(players: readonly PlayerView[]): Standing[] {
  const sorted = [...players].sort((a, b) => b.roundScore - a.roundScore);
  return sorted.map((player) => ({
    player,
    rank: 1 + sorted.filter((p) => p.roundScore > player.roundScore).length,
  }));
}

/** Có đang combo không: từ câu đúng liên tiếp thứ `STREAK_THRESHOLD` trở đi. */
export function hasCombo(streak: number): boolean {
  return streak >= STREAK_THRESHOLD;
}

/**
 * Hệ số combo đã áp cho câu đúng gần nhất khi đang có `streak` câu đúng liên tiếp, tính cả câu đó
 * (3 câu → ×1,1; 4 → ×1,2… tối đa ×1,5). Dùng chính `comboMultiplier` của shared mà server chấm.
 * Hàm đó nhận số câu đúng liên tiếp TRƯỚC câu được chấm nên lùi 1. Làm tròn để bỏ sai số số thực.
 */
export function appliedComboMultiplier(streak: number): number {
  return Math.round(comboMultiplier(Math.max(0, streak - 1)) * 10) / 10;
}
