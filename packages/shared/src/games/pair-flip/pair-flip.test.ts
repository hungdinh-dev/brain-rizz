import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  PAIR_FLIP_ITEMS,
  type PairFlipPuzzle,
  pairFlip,
  pairFlipBoardSize,
  pairFlipInputMs,
  pairFlipLastPair,
} from "./pair-flip";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả, chép lại độc lập với code để test bắt được chỗ lệch. */
const SPEC: Record<Difficulty, { cols: number; rows: number; previewMs: number }> = {
  0: { cols: 3, rows: 2, previewMs: 3_000 },
  1: { cols: 4, rows: 2, previewMs: 3_000 },
  2: { cols: 4, rows: 3, previewMs: 4_000 },
  3: { cols: 4, rows: 4, previewMs: 4_000 },
};

/** Seed vòng thứ i: trải khắp 32 bit thay vì chỉ 0…9 999. */
const roundSeedOf = (i: number) => Math.imul(i + 1, 0x9e3779b1) >>> 0;

/** Duyệt 10.000 câu của một mức: mỗi câu một seed vòng, index xoay vòng 0–29. */
function forEachPuzzle(
  d: Difficulty,
  fn: (p: PairFlipPuzzle, roundSeed: number, index: number) => void,
) {
  for (let i = 0; i < SEEDS; i++) {
    const roundSeed = roundSeedOf(i);
    const index = i % 30;
    fn(pairFlip.generate(roundSeed, index, d), roundSeed, index);
  }
}

/** Các ô người chơi còn chạm được: chưa xong và không phải thẻ đề (thẻ úp). */
const faceDown = (p: PairFlipPuzzle) =>
  p.cards.map((_, i) => i).filter((i) => i !== p.prompt && !p.cleared.includes(i));

// Duyệt hàng nghìn câu: nới thời gian chờ để không trượt khi máy bận chạy song song các file test.
describe("pair-flip", { timeout: 60_000 }, () => {
  it("tất định: sinh hai lần ra giống hệt (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      let mismatches = 0;
      forEachPuzzle(d, (p, roundSeed, index) => {
        const again = pairFlip.generate(roundSeed, index, d);
        if (JSON.stringify(again) !== JSON.stringify(p)) mismatches++;
      });
      expect(mismatches, `mức ${d}`).toBe(0);
    }
  });

  it("tất định giữa các phiên bản: câu đố cố định không đổi", () => {
    // Đổi cách sinh làm hỏng mọi trận đang chạy giữa client cũ và server mới → phải cố ý sửa ở đây.
    expect(pairFlip.generate(777, 0, 0)).toEqual({
      cols: 3,
      rows: 2,
      cards: ["mushroom", "strawberry", "mushroom", "strawberry", "grapes", "grapes"],
      board: 0,
      step: 0,
      steps: 2,
      cleared: [],
      prompt: 1,
      answer: 3,
      gapMs: 0,
      dealMs: 400,
      previewMs: 3_000,
      hideMs: 300,
      promptMs: 300,
    });
    expect(pairFlip.generate(777, 5, 1)).toEqual({
      cols: 4,
      rows: 2,
      cards: ["watermelon", "banana", "banana", "grapes", "grapes", "pear", "pear", "watermelon"],
      board: 1,
      step: 2,
      steps: 3,
      cleared: [0, 3, 4, 7],
      prompt: 6,
      answer: 5,
      gapMs: 0,
      dealMs: 0,
      previewMs: 0,
      hideMs: 0,
      promptMs: 300,
    });
    const big = pairFlip.generate(0xdeadbeef, 9, 3);
    expect([big.board, big.step, big.prompt, big.answer]).toEqual([1, 2, 3, 15]);
    expect(big.cleared).toEqual([0, 1, 4, 10]);
    expect(big.cards.slice(0, 4)).toEqual(["pear", "pear", "mushroom", "strawberry"]);
  });

  it("đúng MỘT đáp án: trong mọi ô chỉ `answer` được nhận (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const failures: string[] = [];
      forEachPuzzle(d, (p) => {
        const accepted: number[] = [];
        // Duyệt mọi giá trị isAnswer nhận (0–15), kể cả ô ngoài bàn nhỏ.
        for (let c = 0; c < 16; c++) {
          if (pairFlip.isAnswer(c) && pairFlip.check(p, c)) accepted.push(c);
        }
        const ok =
          accepted.length === 1 &&
          accepted[0] === p.answer &&
          p.answer !== p.prompt &&
          p.cards[p.answer] === p.cards[p.prompt] &&
          faceDown(p).includes(p.answer) &&
          // Trong các thẻ úp, chỉ đáp án mang vật của thẻ đề.
          faceDown(p).filter((i) => p.cards[i] === p.cards[p.prompt]).length === 1;
        if (!ok && failures.length < 5) failures.push(JSON.stringify(p));
      });
      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("bàn hợp lệ: đúng cỡ, mỗi vật đúng 2 thẻ, các cặp khác vật, lịch đúng bảng", () => {
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      const pairs = (spec.cols * spec.rows) / 2;
      const failures: string[] = [];
      forEachPuzzle(d, (p, _seed, index) => {
        const counts = new Map<string, number>();
        for (const c of p.cards) counts.set(c, (counts.get(c) ?? 0) + 1);
        const opening = p.step === 0;
        const ok =
          p.cols === spec.cols &&
          p.rows === spec.rows &&
          p.cards.length === spec.cols * spec.rows &&
          counts.size === pairs &&
          [...counts.values()].every((n) => n === 2) &&
          p.cards.every((c) => (PAIR_FLIP_ITEMS as readonly string[]).includes(c)) &&
          p.steps === pairs - 1 &&
          p.board === Math.floor(index / p.steps) &&
          p.step === index % p.steps &&
          p.cleared.length === 2 * p.step &&
          p.cleared.every((c, i) => i === 0 || (p.cleared[i - 1] as number) < c) &&
          !p.cleared.includes(p.prompt) &&
          p.gapMs === (opening && p.board > 0 ? 600 : 0) &&
          p.dealMs === (opening ? 400 : 0) &&
          p.previewMs === (opening ? spec.previewMs : 0) &&
          p.hideMs === (opening ? 300 : 0) &&
          p.promptMs === 300;
        if (!ok && failures.length < 5) failures.push(`index ${index}: ${JSON.stringify(p)}`);
      });
      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("các câu cùng bàn nối tiếp nhau: cùng bàn, cặp đề trước thành ô đã xong", () => {
    for (const d of DIFFICULTIES) {
      const { pairs, steps } = pairFlipBoardSize(d);
      let failures = 0;
      for (let i = 0; i < 2_500; i++) {
        const seed = roundSeedOf(i);
        const board = i % 4;
        const puzzles = Array.from({ length: steps }, (_, s) =>
          pairFlip.generate(seed, board * steps + s, d),
        );
        const prompted = new Set<string>();
        for (let s = 0; s < steps; s++) {
          const p = puzzles[s] as PairFlipPuzzle;
          const next = puzzles[s + 1];
          const item = p.cards[p.prompt] as string;
          if (JSON.stringify(p.cards) !== JSON.stringify(puzzles[0]?.cards)) failures++;
          if (prompted.has(item)) failures++; // mỗi cặp làm đề tối đa một lần
          prompted.add(item);
          if (next) {
            const expected = [...p.cleared, p.prompt, p.answer].sort((a, b) => a - b);
            if (JSON.stringify(next.cleared) !== JSON.stringify(expected)) failures++;
          }
        }
        // Câu cuối bàn: còn đúng một cặp tự lật, khác vật mọi cặp đề.
        const last = puzzles[steps - 1] as PairFlipPuzzle;
        const rest = pairFlipLastPair(last);
        if (rest.length !== 2 || last.cards[rest[0] as number] !== last.cards[rest[1] as number]) {
          failures++;
        }
        if (prompted.has(last.cards[rest[0] as number] as string)) failures++;
        if (prompted.size !== pairs - 1) failures++;
        if (pairFlipLastPair(puzzles[0] as PairFlipPuzzle).length !== 0) failures++;
        // Bàn sau khác bàn này (seed bàn riêng).
        const nextBoard = pairFlip.generate(seed, (board + 1) * steps, d);
        if (nextBoard.board !== board + 1 || nextBoard.step !== 0) failures++;
      }
      expect(failures, `mức ${d}`).toBe(0);
    }
  });

  it("khó dần đo được: nhiều thẻ hơn, ít thời gian xem mỗi thẻ hơn, nhiều thẻ úp để chọn hơn", () => {
    const stats = DIFFICULTIES.map((d) => {
      let candidates = 0;
      let count = 0;
      let cards = 0;
      let previewPerCard = 0;
      forEachPuzzle(d, (p) => {
        candidates += faceDown(p).length;
        count++;
        cards = p.cards.length;
        if (p.step === 0) previewPerCard = p.previewMs / p.cards.length;
      });
      return { cards, previewPerCard, avgCandidates: candidates / count };
    });
    // Số thẻ phải nhớ: 6 → 8 → 12 → 16.
    expect(stats.map((s) => s.cards)).toEqual([6, 8, 12, 16]);
    // Thời gian xem mỗi thẻ (ms): 500 → 375 → 333 → 250, giảm ngặt.
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i]?.previewPerCard).toBeLessThan(stats[i - 1]?.previewPerCard as number);
      // Số thẻ úp trung bình để chọn (đoán bừa trúng 1/x): ~4 → ~5 → ~7 → ~9, tăng ngặt.
      expect(stats[i]?.avgCandidates).toBeGreaterThan(
        (stats[i - 1]?.avgCandidates as number) + 0.5,
      );
    }
    expect(stats[0]?.avgCandidates).toBeCloseTo(4, 0);
    expect(stats[3]?.avgCandidates).toBeCloseTo(9, 0);
  });

  it("không thiên vị: vật, vị trí thẻ đề và vị trí đáp án trải đều (10.000 seed)", () => {
    for (const d of DIFFICULTIES) {
      const cells = SPEC[d].cols * SPEC[d].rows;
      const promptAt = new Array<number>(cells).fill(0);
      const answerAt = new Array<number>(cells).fill(0);
      const items = new Map<string, number>();
      forEachPuzzle(d, (p) => {
        promptAt[p.prompt] = (promptAt[p.prompt] as number) + 1;
        answerAt[p.answer] = (answerAt[p.answer] as number) + 1;
        const item = p.cards[p.prompt] as string;
        items.set(item, (items.get(item) ?? 0) + 1);
      });
      const mean = SEEDS / cells;
      for (const n of [...promptAt, ...answerAt])
        expect(Math.abs(n - mean) / mean).toBeLessThan(0.2);
      expect(items.size).toBe(PAIR_FLIP_ITEMS.length);
      const itemMean = SEEDS / PAIR_FLIP_ITEMS.length;
      for (const n of items.values()) expect(Math.abs(n - itemMean) / itemMean).toBeLessThan(0.15);
    }
  });

  it("speedAllowanceMs = thời gian chưa được chạm, tất định, nhỏ hơn vòng", () => {
    for (const d of DIFFICULTIES) {
      const preview = SPEC[d].previewMs;
      const { steps } = pairFlipBoardSize(d);
      expect(pairFlip.speedAllowanceMs?.(pairFlip.generate(1, 0, d), d)).toBe(preview + 1_000);
      expect(pairFlip.speedAllowanceMs?.(pairFlip.generate(1, steps, d), d)).toBe(preview + 1_600);
      expect(pairFlip.speedAllowanceMs?.(pairFlip.generate(1, steps + 1, d), d)).toBe(300);
      forEachPuzzle(d, (p) => {
        const ms = pairFlip.speedAllowanceMs?.(p, d) as number;
        if (ms !== pairFlipInputMs(p) || !Number.isInteger(ms) || ms < 300 || ms > 5_600) {
          throw new Error(`allowance sai: ${ms} ${JSON.stringify(p)}`);
        }
      });
    }
  });

  it("hệ số điểm không giảm khi lên mức", () => {
    const m = DIFFICULTIES.map((d) => pairFlip.difficultyMultiplier?.[d] as number);
    expect(m).toEqual([1, 1, 1.45, 1.95]);
    expect(m).toEqual([...m].sort((a, b) => a - b));
  });

  it("isAnswer() nhận ô 0–15 và từ chối dữ liệu rác", () => {
    for (let c = 0; c < 16; c++) expect(pairFlip.isAnswer(c)).toBe(true);
    for (const bad of [
      -1,
      16,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      [0],
      {},
    ]) {
      expect(pairFlip.isAnswer(bad)).toBe(false);
    }
  });
});
