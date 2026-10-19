/**
 * Lịch hiện của màn vinh danh (CR-010, ui-ux 6.2) — hàm thuần, có test. Mọi mốc tính bằng ms từ
 * lúc vào màn. Giảm chuyển động KHÔNG đổi lịch (chỉ đổi kiểu hiện), nên hàm không cần biết.
 *
 * Nhịp: hạng 4+ từ dưới lên → hạng 3 → hạng 2 → trống dồn 2 s → hạng 1 → thẻ Giỏi nhất mỗi thể loại.
 * Bậc trống (đồng hạng, thiếu người) không chờ: nhịp sau dời lên đúng chỗ của bậc đó.
 */

export const PODIUM_TIMING = {
  /** Hàng hạng 4+ đầu tiên (dưới cùng). */
  first: 600,
  /** Giữa hai hàng hạng 4+. */
  restGap: 450,
  /** Từ hàng hạng 4+ cuối tới hạng 3. */
  afterRest: 900,
  /** Từ hạng 3 tới hạng 2. */
  stepGap: 1400,
  /** Từ hạng 2 tới lúc bắt đầu trống dồn. */
  beforeDrum: 900,
  /** Trống dồn. */
  drum: 2000,
  /** Từ hạng 1 tới thẻ Giỏi nhất mỗi thể loại. */
  afterWinner: 1600,
  /** Giữa hai hàng của thẻ thể loại. */
  bestRowGap: 120,
  /** Nhãn "Bạn về …" hiện sau khi chỗ của mình lật. */
  youDelay: 300,
} as const;

export interface PodiumTimelineInput {
  /** Số người ở từng bậc hạng 1, 2, 3 (đồng hạng chung bậc; 0 = bậc trống). */
  podiumSizes: readonly [number, number, number];
  /** Số hàng hạng 4+ (theo thứ tự hiển thị, từ trên xuống). */
  restCount: number;
  /** Số hàng của thẻ Giỏi nhất mỗi thể loại (0 = không có thẻ). */
  bestRows: number;
}

export interface PodiumTimeline {
  /** Mốc lật từng hàng hạng 4+, theo thứ tự hiển thị (hàng trên cùng lật sau cùng). */
  rest: number[];
  /** Mốc lật bậc hạng 1, 2, 3; `null` = bậc trống. */
  podium: [number | null, number | null, number | null];
  /** Trống dồn (không có hạng 1 thì `null`). */
  drum: { start: number; end: number } | null;
  /** Thẻ thể loại: lúc thay khung giữ chỗ bằng thẻ thật và mốc từng hàng; `null` = không có thẻ. */
  best: { start: number; rows: number[] } | null;
  /** Mọi thứ đã hiện. */
  end: number;
}

export function podiumTimeline({
  podiumSizes,
  restCount,
  bestRows,
}: PodiumTimelineInput): PodiumTimeline {
  const T = PODIUM_TIMING;
  const n = Math.max(0, restCount);
  // Hàng thứ i đếm từ dưới lên lật lúc first + gap·i → hàng hiển thị thứ k (từ trên) là i = n−1−k.
  const rest = Array.from({ length: n }, (_, k) => T.first + T.restGap * (n - 1 - k));
  let cursor = n > 0 ? T.first + T.restGap * (n - 1) + T.afterRest : T.first;

  const podium: PodiumTimeline["podium"] = [null, null, null];
  if (podiumSizes[2] > 0) {
    podium[2] = cursor;
    cursor += T.stepGap;
  }
  if (podiumSizes[1] > 0) {
    podium[1] = cursor;
    cursor += T.beforeDrum;
  }

  let drum: PodiumTimeline["drum"] = null;
  if (podiumSizes[0] > 0) {
    drum = { start: cursor, end: cursor + T.drum };
    podium[0] = drum.end;
    cursor = drum.end;
  }

  let best: PodiumTimeline["best"] = null;
  if (bestRows > 0) {
    const start = (podium[0] ?? cursor) + T.afterWinner;
    best = { start, rows: Array.from({ length: bestRows }, (_, i) => start + T.bestRowGap * i) };
  }

  const end = Math.max(cursor, ...rest, ...(best?.rows ?? []), best?.start ?? 0);
  return { rest, podium, drum, best, end };
}
