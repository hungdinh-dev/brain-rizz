import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Đếm sĩ số (nhóm Tính toán): lớp học có sẵn vài bạn, tường trước hạ xuống che lớp; các bạn đi
 * vào, đi ra qua cửa; cửa đóng thì chạm thẻ số bạn còn trong lớp. Siêu khó có thầy giáo đi lẫn
 * vào/ra, thầy không tính vào sĩ số. Đặc tả: docs/04-minigames/head-count.md.
 */

/**
 * Một lượt đi qua cửa, chạy trong đúng một bước `stepMs`. Bạn đi vào đến từ hành lang bên trái,
 * bạn đi ra đi về hành lang bên phải; lượt vừa vào vừa ra thì hai dòng đi cùng lúc.
 */
export interface HeadCountEvent {
  /** Số bạn đi VÀO lớp ở lượt này (0–2). */
  in: number;
  /** Số bạn đi RA khỏi lớp ở lượt này (0–2). Luôn ít hơn số bạn đang có trong lớp. */
  out: number;
  /**
   * Chỉ Siêu khó: thầy giáo cũng đi qua cửa ở lượt này, theo hướng này (cùng hướng với các bạn
   * nếu lượt có bạn đi). Thầy KHÔNG tính vào sĩ số. Không có trường này = không có thầy.
   */
  teacher?: "in" | "out";
}

/**
 * Câu đố. Dòng thời gian (ms, tính từ lúc scene hiện câu); scene chạy theo đúng các mốc này,
 * không đếm khung hình:
 * - `[0, showMs)`: thấy lớp mở, `start` bạn ngồi ở bàn, bảng sĩ số ghi `start`; cuối pha tường
 *   trước hạ xuống che lớp.
 * - lượt `k` (đếm từ 0) chạy trong `[headCountEventStartMs(p, k), … + stepMs)`.
 * - từ `headCountInputAtMs(p)`: cửa đóng, hiện 4 thẻ số, được chạm.
 */
export interface HeadCountPuzzle {
  /** Số bạn trong lớp lúc đầu (không tính thầy). */
  start: number;
  /** Chỉ Siêu khó có thể `true`: thầy đứng trong lớp lúc đầu, lượt thầy đầu tiên là đi ra. */
  teacherAtStart: boolean;
  /** Các lượt theo thứ tự. */
  events: HeadCountEvent[];
  /** Thời gian xem lớp lúc đầu (ms), gồm cả lúc tường hạ xuống. */
  showMs: number;
  /** Thời gian một lượt (ms), mọi lượt như nhau. */
  stepMs: number;
  /** 4 thẻ số trái → phải: 4 số nguyên liên tiếp, tăng dần, trong [1, 9], chứa đáp án. */
  options: number[];
  /** Chỉ số thẻ đúng trong `options`: thẻ ghi `start + Σin − Σout`. */
  answerIndex: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm trong `options` (0–3), gửi một lần mỗi câu. */
export type HeadCountAnswer = number;

/**
 * Lớp có 9 bàn (3 × 3). Sĩ số luôn trong [MIN, MAX] ở MỌI thời điểm, kể cả giữa một lượt vừa
 * vào vừa ra (dù bạn đi ra hay đi vào trước): lớp không bao giờ trống, không bao giờ thiếu bàn.
 */
export const HEAD_COUNT_MIN_IN_ROOM = 1;
export const HEAD_COUNT_MAX_IN_ROOM = 9;
/** Số thẻ chọn ở mọi mức. */
export const HEAD_COUNT_OPTIONS = 4;

interface LevelParams {
  /** Sĩ số đầu [ít nhất, nhiều nhất]. */
  start: readonly [number, number];
  /** Số lượt [ít nhất, nhiều nhất]. */
  events: readonly [number, number];
  stepMs: number;
  showMs: number;
  /** Số bạn nhiều nhất mỗi hướng trong một lượt. */
  maxGroup: number;
  /** Lượt một chiều thường: trọng số đi 2 bạn trên 100 (khi `maxGroup` = 2). */
  pairPct: number;
  /** Số lượt một chiều bắt buộc 2 bạn. */
  minPairs: number;
  /** Số lượt vừa vào vừa ra [ít nhất, nhiều nhất]. */
  mixed: readonly [number, number];
  /**
   * Số lượt có thầy [ít nhất, nhiều nhất], chỉ dùng số LẺ: thầy vào rồi ra (2 lượt) thì người
   * lỡ đếm cả thầy vẫn ra đúng số, bẫy mất tác dụng. 1 lượt = thầy chỉ vào (rồi ở lại) hoặc
   * chỉ ra (nếu đứng trong lớp từ đầu), nên đếm nhầm thầy luôn lệch đúng 1.
   */
  teacher: readonly [number, number];
  /** Lượt có thầy: trọng số có bạn đi cùng hướng với thầy trên 100 (còn lại thầy đi một mình). */
  teacherGroupPct: number;
  /** Thẻ nhỏ nhất [ít nhất, nhiều nhất]: 4 thẻ là `lo … lo + 3`. */
  lowestOption: readonly [number, number];
}

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả, test và tính lại hệ số điểm. */
export const HEAD_COUNT_LEVELS: Readonly<Record<Difficulty, Readonly<LevelParams>>> = {
  // Mầm: 3 HOẶC 4 lượt, sĩ số đầu 2 hoặc 3 (kế hoạch: 2 bạn, 3 lượt). Mỗi lượt đúng 1 bạn nên
  // chẵn/lẻ của đáp án = chẵn/lẻ của (sĩ số đầu + số lượt); cố định 2 bạn, 3 lượt thì đáp án
  // LUÔN lẻ, và chỉ có ~12 câu khác nhau.
  0: {
    start: [2, 3],
    events: [3, 4],
    stepMs: 900,
    showMs: 1_200,
    maxGroup: 1,
    pairPct: 0,
    minPairs: 0,
    mixed: [0, 0],
    teacher: [0, 0],
    teacherGroupPct: 0,
    lowestOption: [1, 3],
  },
  1: {
    start: [3, 5],
    events: [5, 5],
    stepMs: 700,
    showMs: 1_000,
    maxGroup: 2,
    pairPct: 30,
    minPairs: 1,
    mixed: [0, 0],
    teacher: [0, 0],
    teacherGroupPct: 0,
    lowestOption: [1, 6],
  },
  2: {
    start: [3, 6],
    events: [6, 6],
    stepMs: 550,
    showMs: 1_000,
    maxGroup: 2,
    pairPct: 30,
    minPairs: 1,
    mixed: [1, 2],
    teacher: [0, 0],
    teacherGroupPct: 0,
    lowestOption: [1, 6],
  },
  3: {
    start: [4, 7],
    events: [7, 7],
    stepMs: 450,
    showMs: 1_000,
    maxGroup: 2,
    pairPct: 30,
    minPairs: 1,
    mixed: [2, 2],
    teacher: [1, 1],
    teacherGroupPct: 50,
    lowestOption: [1, 6],
  },
};

/** Mốc bắt đầu lượt `k` (ms, tính từ lúc câu hiện ra). */
export function headCountEventStartMs(
  puzzle: Pick<HeadCountPuzzle, "showMs" | "stepMs">,
  k: number,
): number {
  return puzzle.showMs + k * puzzle.stepMs;
}

/**
 * Mốc cửa đóng, hiện thẻ và bắt đầu được chạm (ms, tính từ lúc câu hiện ra) =
 * `showMs + số lượt × stepMs`. Scene và server dùng chung con số này.
 */
export function headCountInputAtMs(
  puzzle: Pick<HeadCountPuzzle, "showMs" | "stepMs" | "events">,
): number {
  return headCountEventStartMs(puzzle, puzzle.events.length);
}

/**
 * Sĩ số sau từng lượt: phần tử 0 là `start`, phần tử `k + 1` là sau lượt `k`; phần tử cuối là
 * đáp án. Thầy không tính.
 */
export function headCountTally(puzzle: Pick<HeadCountPuzzle, "start" | "events">): number[] {
  const out = [puzzle.start];
  let count = puzzle.start;
  for (const e of puzzle.events) {
    count += e.in - e.out;
    out.push(count);
  }
  return out;
}

/** Loại lượt: một chiều, một chiều bắt buộc 2 bạn, vừa vào vừa ra, có thầy (kèm hướng của thầy). */
type Slot =
  | { kind: "single" }
  | { kind: "pair" }
  | { kind: "mixed" }
  | { kind: "teacher"; dir: "in" | "out" };

/** Một cách đi của lượt, kèm trọng số (số nguyên) để chọn ngẫu nhiên. */
interface Move {
  event: HeadCountEvent;
  weight: number;
}

function intIn(rng: Rng, range: readonly [number, number]): number {
  return rng.int(range[0], range[1]);
}

/**
 * Xếp loại cho từng lượt, vị trí các loại đặc biệt chọn đều. Hướng của thầy đổi luân phiên:
 * đang ở trong lớp thì ra, ở ngoài thì vào.
 */
function planSlots(rng: Rng, level: LevelParams, n: number, teacherAtStart: boolean): Slot[] {
  const mixed = intIn(rng, level.mixed);
  const teacher = intIn(rng, level.teacher);
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const kinds: Slot["kind"][] = new Array(n).fill("single");
  let next = 0;
  for (let i = 0; i < mixed; i++) kinds[order[next++] as number] = "mixed";
  for (let i = 0; i < teacher; i++) kinds[order[next++] as number] = "teacher";
  for (let i = 0; i < level.minPairs; i++) kinds[order[next++] as number] = "pair";

  let inside = teacherAtStart;
  return kinds.map((kind): Slot => {
    if (kind !== "teacher") return { kind };
    const dir = inside ? "out" : "in";
    inside = !inside;
    return { kind, dir };
  });
}

/**
 * Mọi cách đi của lượt `slot` khi lớp đang có `count` bạn. Chỉ giữ cách đi mà sĩ số không ra
 * khỏi [MIN, MAX] ở bất kỳ thời điểm nào: ra ≤ count − MIN, vào ≤ MAX − count.
 */
function movesFor(slot: Slot, level: LevelParams, count: number): Move[] {
  const raw: Move[] = [];
  const g = level.maxGroup;
  switch (slot.kind) {
    case "single":
      for (let s = 1; s <= g; s++) {
        const weight = s === 1 ? 100 - level.pairPct : level.pairPct;
        raw.push({ event: { in: s, out: 0 }, weight }, { event: { in: 0, out: s }, weight });
      }
      break;
    case "pair":
      raw.push({ event: { in: 2, out: 0 }, weight: 1 }, { event: { in: 0, out: 2 }, weight: 1 });
      break;
    case "mixed":
      // Vào i, ra j với i ≠ j: lượt nào cũng đổi sĩ số, bỏ sót một dòng là sai.
      for (let i = 1; i <= g; i++) {
        for (let j = 1; j <= g; j++) {
          if (i !== j) raw.push({ event: { in: i, out: j }, weight: 1 });
        }
      }
      break;
    case "teacher":
      raw.push({
        event: { in: 0, out: 0, teacher: slot.dir },
        weight: (100 - level.teacherGroupPct) * g,
      });
      for (let s = 1; s <= g; s++) {
        raw.push({
          event:
            slot.dir === "in"
              ? { in: s, out: 0, teacher: "in" }
              : { in: 0, out: s, teacher: "out" },
          weight: level.teacherGroupPct,
        });
      }
      break;
  }
  return raw.filter(
    (m) =>
      m.weight > 0 &&
      count - m.event.out >= HEAD_COUNT_MIN_IN_ROOM &&
      count + m.event.in <= HEAD_COUNT_MAX_IN_ROOM,
  );
}

/**
 * Bảng với tới: `reach[k][c]` là mặt nạ bit các đáp án cuối có thể đạt được nếu trước lượt `k`
 * lớp có `c` bạn (bit `a` bật = đạt được `a`).
 */
function reachTable(slots: readonly Slot[], level: LevelParams): number[][] {
  const n = slots.length;
  const reach: number[][] = new Array(n + 1);
  reach[n] = Array.from({ length: HEAD_COUNT_MAX_IN_ROOM + 1 }, (_, c) =>
    c >= HEAD_COUNT_MIN_IN_ROOM ? 1 << c : 0,
  );
  for (let k = n - 1; k >= 0; k--) {
    const next = reach[k + 1] as number[];
    reach[k] = Array.from({ length: HEAD_COUNT_MAX_IN_ROOM + 1 }, (_, c) => {
      if (c < HEAD_COUNT_MIN_IN_ROOM) return 0;
      let mask = 0;
      for (const m of movesFor(slots[k] as Slot, level, c)) {
        mask |= next[c + m.event.in - m.event.out] as number;
      }
      return mask;
    });
  }
  return reach;
}

/** Chọn một cách đi theo trọng số. */
function pickWeighted(rng: Rng, moves: readonly Move[]): Move {
  const total = moves.reduce((sum, m) => sum + m.weight, 0);
  let x = rng.int(1, total);
  for (const m of moves) {
    x -= m.weight;
    if (x <= 0) return m;
  }
  return moves[moves.length - 1] as Move;
}

export const headCount: MinigameDef<HeadCountPuzzle, HeadCountAnswer> = {
  id: "head-count",
  category: "compute",
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả. Hệ số để điểm vòng bằng Thường:
   * Mầm (trẻ 7 tuổi) cần 1,29 → giữ 1 (Mầm = min(mô phỏng, 1)); Khó 1,25; Siêu khó 1,75.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.25, 3: 1.75 },

  generate(roundSeed, index, difficulty) {
    const level = HEAD_COUNT_LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const n = intIn(rng, level.events);
    const start = intIn(rng, level.start);
    const teacherAtStart = level.teacher[1] > 0 && rng.int(0, 1) === 1;
    const slots = planSlots(rng, level, n, teacherAtStart);
    const reach = reachTable(slots, level);
    const reachable = (reach[0] as number[])[start] as number;

    // Chọn thẻ TRƯỚC, rồi mới cho các bạn đi sao cho ra đúng đáp án: thẻ nhỏ nhất `lo` và vị
    // trí đáp án `r` chọn đều trong các cặp đạt được. Nhờ vậy nhìn 4 thẻ không đoán được thẻ
    // nào đúng (mỗi vị trí ~1/4). Nhiễu lệch ±1…±3: nếu chỉ lệch ±1/±2 thì đáp án không bao
    // giờ là số nhỏ nhất hay lớn nhất, loại ngay được 2 thẻ.
    const choices: [number, number][] = [];
    for (let lo = level.lowestOption[0]; lo <= level.lowestOption[1]; lo++) {
      for (let r = 0; r < HEAD_COUNT_OPTIONS; r++) {
        if ((reachable >> (lo + r)) & 1) choices.push([lo, r]);
      }
    }
    // Luôn có lựa chọn: từ mọi sĩ số trong [MIN, MAX], lượt một chiều 1 bạn luôn đưa được về
    // [MIN + 1, MAX − 1] mà lượt vừa vào vừa ra cần, nên mọi dãy lượt đều đi được tới cuối, và
    // mọi đáp án đạt được đều nằm trong [lo nhỏ nhất, lo lớn nhất + 3]. Rỗng = bảng tham số sai.
    if (choices.length === 0) throw new Error("head-count: bảng độ khó không sinh được câu đố");
    const [lo, answerIndex] = rng.pick(choices);
    const target = lo + answerIndex;

    const events: HeadCountEvent[] = [];
    let count = start;
    for (let k = 0; k < n; k++) {
      const next = reach[k + 1] as number[];
      const moves = movesFor(slots[k] as Slot, level, count).filter(
        (m) => ((next[count + m.event.in - m.event.out] as number) >> target) & 1,
      );
      const { event } = pickWeighted(rng, moves);
      events.push(event);
      count += event.in - event.out;
    }

    return {
      start,
      teacherAtStart,
      events,
      showMs: level.showMs,
      stepMs: level.stepMs,
      options: Array.from({ length: HEAD_COUNT_OPTIONS }, (_, i) => lo + i),
      answerIndex,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  /** Số nguyên 0–3. */
  isAnswer(value): value is HeadCountAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < HEAD_COUNT_OPTIONS
    );
  },

  /** CR-006: miễn trừ thưởng tốc độ = toàn bộ phần trình chiếu, lúc chưa có thẻ để chạm. */
  speedAllowanceMs(puzzle) {
    return headCountInputAtMs(puzzle);
  },
};
