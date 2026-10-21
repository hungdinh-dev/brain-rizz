import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Nhại nhịp (nhóm Ghi nhớ): trống gõ một câu nhịp (có tiếng và mặt trống sáng theo từng tiếng),
 * người chơi gõ lại đúng câu đó bằng nửa trái / nửa phải màn hình.
 * Chấm thứ tự trái/phải và KHOẢNG CÁCH giữa các tiếng liên tiếp, không chấm thời điểm tuyệt đối,
 * để độ trễ cố định của từng máy tự triệt tiêu. Đặc tả: docs/04-minigames/rhythm-echo.md.
 */

/** Mặt trống. Mầm chỉ có một trống: mọi tiếng là `"left"`, client quy mọi lần gõ về `"left"`. */
export type RhythmEchoSide = "left" | "right";

/** Một tiếng trống: mặt nào, lúc nào (ms, số nguyên). */
export interface RhythmEchoHit {
  side: RhythmEchoSide;
  atMs: number;
}

/**
 * Câu đố. Lịch trình chiếu (ms, tính từ lúc câu hiện ra): tiếng thứ `k` vang lúc
 * `leadMs + hits[k].atMs`; người chơi được gõ từ `rhythmEchoListenMs(puzzle)`.
 */
export interface RhythmEchoPuzzle {
  /** Số mặt trống: 1 (Mầm) hoặc 2. */
  drums: 1 | 2;
  /** Câu nhịp, `hits[0].atMs = 0`, `atMs` tăng dần. Chính mảng này là một đáp án đúng. */
  hits: RhythmEchoHit[];
  /** Dung sai (ms) cho mỗi khoảng cách giữa hai tiếng liên tiếp. */
  tolMs: number;
  /** Đơn vị nhịp (ms) = nửa phách; mọi khoảng cách là bội của nó. Scene dùng để vẽ vạch phách. */
  unitMs: number;
  /** Khoảng chờ từ lúc câu hiện ra tới tiếng đầu (ms). */
  leadMs: number;
  /** Khoảng lặng sau tiếng cuối trước khi tới lượt gõ (ms). */
  tailMs: number;
}

/**
 * Đáp án = các lần gõ theo thứ tự, `atMs` đo ở client tính từ lần gõ đầu tiên (lần đầu = 0),
 * làm tròn ms. Client gửi MỘT lần mỗi câu: đủ `hits.length` lần gõ, hoặc ngay khi chắc chắn sai
 * (gõ sai mặt, lệch nhịp, quá hạn tiếng kế) với các lần gõ tới lúc đó.
 */
export type RhythmEchoAnswer = RhythmEchoHit[];

/** Kiểu câu nhịp: đều (mọi khoảng 1 phách), có nghỉ + nốt ngắn, nghịch phách. */
type RhythmStyle = "even" | "rests" | "syncopated";

interface LevelParams {
  drums: 1 | 2;
  /** Số tiếng có thể có; bốc đều. */
  hitCounts: readonly number[];
  tolMs: number;
  /** Các đơn vị nhịp (nửa phách, ms) có thể có; bốc đều. */
  unitChoices: readonly number[];
  style: RhythmStyle;
  /** Độ dài câu tối đa, tính bằng đơn vị nhịp. */
  maxSpanUnits: number;
  /** Số lần đổi mặt trống tối thiểu giữa hai tiếng liền nhau (2 trống). */
  minSwitches: number;
}

const LEAD_MS = 500;
const TAIL_MS = 400;
const DURATION_MS = 60_000;

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  // Phách 500–800 ms, mỗi bước 50 ms.
  0: {
    drums: 1,
    hitCounts: [3],
    tolMs: 150,
    unitChoices: [250, 275, 300, 325, 350, 375, 400],
    style: "even",
    maxSpanUnits: 4,
    minSwitches: 0,
  },
  // Phách 400–700 ms, mỗi bước 50 ms.
  1: {
    drums: 2,
    hitCounts: [4],
    tolMs: 120,
    unitChoices: [200, 225, 250, 275, 300, 325, 350],
    style: "even",
    maxSpanUnits: 6,
    minSwitches: 1,
  },
  2: {
    drums: 2,
    hitCounts: [5, 6],
    tolMs: 100,
    unitChoices: [260, 280, 300],
    style: "rests",
    maxSpanUnits: 10,
    minSwitches: 1,
  },
  3: {
    drums: 2,
    hitCounts: [6],
    tolMs: 80,
    unitChoices: [260, 280],
    style: "syncopated",
    maxSpanUnits: 10,
    minSwitches: 2,
  },
};

/** Khoảng cách (đơn vị nhịp) được dùng ở từng kiểu câu nhịp. */
const GAP_UNITS: Readonly<Record<RhythmStyle, readonly number[]>> = {
  even: [2],
  rests: [1, 2, 4],
  syncopated: [1, 2, 3, 4],
};

/** Số tiếng dài nhất ở mọi mức = độ dài tối đa của đáp án. */
const MAX_HITS = Math.max(...DIFFICULTIES.flatMap((d) => LEVELS[d].hitCounts));

/**
 * Bỏ qua lần gõ cùng mặt tới sớm hơn ngần này ms sau lần gõ trước (ngón tay nảy, chuột kêu đúp).
 * Luôn nhỏ hơn khoảng cách nhỏ nhất còn được chấm đúng ở mọi mức (test kiểm), nên bộ lọc này không
 * bao giờ chặn nhầm một lần gõ của đáp án đúng.
 */
export const RHYTHM_ECHO_DEBOUNCE_MS = 100;

/** Số tiếng nghịch phách: tiếng rơi vào nửa phách (vị trí lẻ) mà phách kế tiếp không có tiếng. */
function syncopations(gaps: readonly number[]): number {
  let count = 0;
  let pos = 0;
  for (let k = 0; k < gaps.length - 1; k++) {
    pos += gaps[k] as number;
    if (pos % 2 === 1 && (gaps[k + 1] as number) >= 2) count++;
  }
  return count;
}

/** Độ dài lớn nhất của một dãy nốt ngắn (khoảng 1 đơn vị) liền nhau. */
function runsOfShort(gaps: readonly number[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const g of gaps) {
    if (g === 1) run++;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

/** Câu nhịp (dãy khoảng cách theo đơn vị) có hợp luật của kiểu không. */
function isValidRhythm(style: RhythmStyle, gaps: readonly number[], maxSpan: number): boolean {
  const span = gaps.reduce((a, b) => a + b, 0);
  if (span > maxSpan) return false;
  const runs = runsOfShort(gaps);
  switch (style) {
    case "even":
      return true;
    case "rests":
      // Nốt ngắn luôn đi đôi (móc đơn "ti-ti"), nên mọi tiếng khác rơi đúng phách: không nghịch phách.
      // Phải có ít nhất một đôi nốt ngắn và một chỗ nghỉ (khoảng 2 phách).
      return runs.length > 0 && runs.every((r) => r === 2) && gaps.includes(4);
    case "syncopated":
      // Không quá 2 nốt ngắn liền nhau (giới hạn nháy, xem đặc tả); có ít nhất một tiếng nghịch phách.
      return runs.every((r) => r <= 2) && syncopations(gaps) >= 1;
  }
}

/** Mọi câu nhịp hợp lệ gồm `gapCount` khoảng, theo thứ tự từ điển (tất định, không dùng rng). */
function rhythmsOf(style: RhythmStyle, gapCount: number, maxSpan: number): number[][] {
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length === gapCount) {
      if (isValidRhythm(style, prefix, maxSpan)) out.push(prefix);
      return;
    }
    for (const g of GAP_UNITS[style]) walk([...prefix, g]);
  };
  walk([]);
  return out;
}

/** Mọi dãy mặt trống dài `length` có ít nhất `minSwitches` lần đổi mặt (2 trống). */
function sideSequencesOf(length: number, minSwitches: number): RhythmEchoSide[][] {
  const out: RhythmEchoSide[][] = [];
  for (let mask = 0; mask < 1 << length; mask++) {
    const seq: RhythmEchoSide[] = [];
    for (let k = 0; k < length; k++) seq.push((mask >> k) & 1 ? "right" : "left");
    let switches = 0;
    for (let k = 1; k < length; k++) if (seq[k] !== seq[k - 1]) switches++;
    if (switches >= minSwitches) out.push(seq);
  }
  return out;
}

/** Bảng câu nhịp và dãy mặt trống của từng mức, theo số tiếng. Tính một lần lúc nạp module. */
const CATALOG: Readonly<
  Record<Difficulty, ReadonlyMap<number, { rhythms: number[][]; sides: RhythmEchoSide[][] }>>
> = Object.fromEntries(
  DIFFICULTIES.map((d) => {
    const level = LEVELS[d];
    const byCount = new Map(
      level.hitCounts.map((n) => [
        n,
        {
          rhythms: rhythmsOf(level.style, n - 1, level.maxSpanUnits),
          sides:
            level.drums === 1
              ? [Array.from({ length: n }, (): RhythmEchoSide => "left")]
              : sideSequencesOf(n, level.minSwitches),
        },
      ]),
    );
    return [d, byCount];
  }),
) as Record<Difficulty, Map<number, { rhythms: number[][]; sides: RhythmEchoSide[][] }>>;

/** Độ dài câu nhịp (ms): từ tiếng đầu tới tiếng cuối. Cũng là thời gian gõ tối thiểu. */
export function rhythmEchoSpanMs(puzzle: Pick<RhythmEchoPuzzle, "hits">): number {
  const { hits } = puzzle;
  return hits.length === 0
    ? 0
    : (hits[hits.length - 1] as RhythmEchoHit).atMs - (hits[0] as RhythmEchoHit).atMs;
}

/**
 * Hết pha nghe (ms, tính từ lúc câu hiện ra) = lúc bắt đầu nhận gõ. Scene và server dùng chung.
 * = `leadMs` + độ dài câu nhịp + `tailMs`.
 */
export function rhythmEchoListenMs(
  puzzle: Pick<RhythmEchoPuzzle, "hits" | "leadMs" | "tailMs">,
): number {
  return puzzle.leadMs + rhythmEchoSpanMs(puzzle) + puzzle.tailMs;
}

/**
 * Vị trí lần gõ sai đầu tiên trong `taps` (gõ thừa, sai mặt, hoặc khoảng cách tới lần gõ trước
 * lệch quá `tolMs`), hoặc -1 nếu mọi lần gõ tới giờ đều khớp. Client chấm từng lần gõ bằng hàm
 * này; `check` của server dùng chính nó, nên hai bên không bao giờ chấm khác nhau.
 */
export function rhythmEchoFirstMiss(
  puzzle: Pick<RhythmEchoPuzzle, "hits" | "tolMs">,
  taps: readonly RhythmEchoHit[],
): number {
  const { hits, tolMs } = puzzle;
  for (let k = 0; k < taps.length; k++) {
    const tap = taps[k] as RhythmEchoHit;
    const hit = hits[k];
    if (hit === undefined) return k;
    if (tap.side !== hit.side) return k;
    if (k > 0) {
      const want = hit.atMs - (hits[k - 1] as RhythmEchoHit).atMs;
      const got = tap.atMs - (taps[k - 1] as RhythmEchoHit).atMs;
      if (Math.abs(got - want) > tolMs) return k;
    }
  }
  return -1;
}

/**
 * Khung thời gian (cùng gốc với `taps`, ms) mà lần gõ kế tiếp phải rơi vào để còn đúng:
 * `[lần gõ trước + khoảng − tolMs, lần gõ trước + khoảng + tolMs]`, hai đầu đều được tính đúng.
 * `undefined` khi chưa gõ lần nào (lần đầu không có hạn) hoặc đã gõ đủ. Quá `toMs` mà chưa gõ
 * thì câu chắc chắn sai: client gửi ngay các lần gõ đã có.
 */
export function rhythmEchoNextWindow(
  puzzle: Pick<RhythmEchoPuzzle, "hits" | "tolMs">,
  taps: readonly RhythmEchoHit[],
): { fromMs: number; toMs: number } | undefined {
  const k = taps.length;
  const { hits, tolMs } = puzzle;
  if (k === 0 || k >= hits.length) return undefined;
  const want =
    (taps[k - 1] as RhythmEchoHit).atMs +
    (hits[k] as RhythmEchoHit).atMs -
    (hits[k - 1] as RhythmEchoHit).atMs;
  return { fromMs: want - tolMs, toMs: want + tolMs };
}

export const rhythmEcho: MinigameDef<RhythmEchoPuzzle, RhythmEchoAnswer> = {
  id: "rhythm-echo",
  category: "memorize",
  // CR-006: mặc định 60 s; mỗi câu có 2,1–4,1 s nghe không gõ được.
  durationMs: DURATION_MS,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả (nghe + gõ, tỉ lệ đúng mục tiêu,
   * khoá 1,5 s khi sai, combo trần × 1,5). Hệ số cần để điểm vòng bằng Thường: Mầm (trẻ 7 tuổi)
   * 1,04; Khó 2,44; Siêu khó 2,71. Mầm giữ 1 để hệ số không bao giờ giảm khi lên mức. Khó và
   * Siêu khó cao vì câu dài gấp rưỡi Thường (5–6 tiếng, có nghỉ) nên mỗi vòng ít câu hơn hẳn.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 2.45, 3: 2.7 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const count = rng.pick(level.hitCounts);
    const unitMs = rng.pick(level.unitChoices);
    const options = CATALOG[difficulty].get(count);
    if (!options) throw new Error(`rhythm-echo: thiếu câu nhịp ${count} tiếng`);
    const gaps = rng.pick(options.rhythms);
    const sides = rng.pick(options.sides);

    const hits: RhythmEchoHit[] = [];
    let atMs = 0;
    for (let k = 0; k < count; k++) {
      if (k > 0) atMs += (gaps[k - 1] as number) * unitMs;
      hits.push({ side: sides[k] as RhythmEchoSide, atMs });
    }

    return {
      drums: level.drums,
      hits,
      tolMs: level.tolMs,
      unitMs,
      leadMs: LEAD_MS,
      tailMs: TAIL_MS,
    };
  },

  /**
   * Đúng khi và chỉ khi gõ đủ số tiếng, đúng mặt từng tiếng, và mỗi khoảng cách giữa hai lần gõ
   * liền nhau lệch không quá `tolMs` so với câu nhịp. Không xét thời điểm tuyệt đối: dời cả đáp án
   * đi bao nhiêu cũng vậy.
   */
  check(puzzle, answer) {
    return answer.length === puzzle.hits.length && rhythmEchoFirstMiss(puzzle, answer) === -1;
  },

  /**
   * Mảng 1–6 lần gõ; mỗi lần là object có `side` là "left" | "right" và `atMs` là số nguyên
   * trong [0, 60 000]; `atMs` không giảm (hai lần gõ cùng ms vẫn hợp lệ, `check` chấm sai).
   */
  isAnswer(value): value is RhythmEchoAnswer {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_HITS) return false;
    let prev = 0;
    // Duyệt theo chỉ số (không dùng every) để mảng thưa cũng bị từ chối.
    for (let i = 0; i < value.length; i++) {
      const tap: unknown = value[i];
      if (typeof tap !== "object" || tap === null || Array.isArray(tap)) return false;
      const { side, atMs } = tap as { side?: unknown; atMs?: unknown };
      if (side !== "left" && side !== "right") return false;
      if (typeof atMs !== "number" || !Number.isInteger(atMs)) return false;
      if (atMs < 0 || atMs > DURATION_MS || (i > 0 && atMs < prev)) return false;
      prev = atMs;
    }
    return true;
  },

  /**
   * CR-006: miễn trừ thưởng tốc độ = pha nghe (không gõ được) + độ dài câu nhịp (thời gian gõ bắt
   * buộc). Phần còn lại tính thưởng tốc độ chỉ là lúc chờ trước lần gõ đầu.
   */
  speedAllowanceMs(puzzle) {
    return rhythmEchoListenMs(puzzle) + rhythmEchoSpanMs(puzzle);
  },
};
