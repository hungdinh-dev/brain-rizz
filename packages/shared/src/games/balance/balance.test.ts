import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { BALANCE_ITEMS, type BalancePuzzle, type BalanceScale, balance } from "./balance";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả (docs/04-minigames/balance.md), theo thứ tự Mầm → Siêu khó. */
const ITEM_COUNT = [3, 4, 5, 6];
const SCALE_COUNT = [2, 3, 4, 5];
const EQUAL_COUNT = [0, 0, 1, 1];
const DOUBLE_PAN_COUNT = [0, 0, 0, 1];
/** Số vật chưa từng bị nhấc (ứng viên còn lại sau khi loại vật ở đĩa nhẹ). */
const CANDIDATE_COUNT = [1, 1, 2, 3];
/** Số bước suy luận tới vật xa nhất: [ít nhất, nhiều nhất]. */
const DEPTH_RANGE: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 4],
  [1, 4],
];
/** Tỉ lệ câu có vật sai thắng nhiều cân nghiêng hơn vật đúng (đo trên 10.000 seed). */
const WRONG_WINS_MORE = [0, 0.17, 0.16, 0.26];

const cache = new Map<Difficulty, BalancePuzzle[]>();
const roundSeedOf = (s: number) => s;
const indexOf = (s: number) => s % 37;

/** 10.000 câu mỗi mức, sinh một lần rồi dùng chung cho mọi test. */
function puzzlesOf(d: Difficulty): BalancePuzzle[] {
  let list = cache.get(d);
  if (!list) {
    list = Array.from({ length: SEEDS }, (_, s) => balance.generate(roundSeedOf(s), indexOf(s), d));
    cache.set(d, list);
  }
  return list;
}

/** Chạy `fn` cho mọi câu của mọi mức; gom tối đa 5 lỗi đầu tiên để báo. */
function expectEvery(fn: (p: BalancePuzzle, d: Difficulty, seed: number) => string | null) {
  const bad: string[] = [];
  let failures = 0;
  for (const d of DIFFICULTIES) {
    puzzlesOf(d).forEach((p, s) => {
      const msg = fn(p, d, s);
      if (msg === null) return;
      failures++;
      if (bad.length < 5) bad.push(`độ khó ${d}, seed ${s}: ${msg}`);
    });
  }
  expect(bad, `${failures} câu lỗi`).toEqual([]);
}

const isDoublePan = (s: BalanceScale) => s.left.length + s.right.length > 2;
const lighterPan = (s: BalanceScale) =>
  s.heavier === "left" ? s.right : s.heavier === "right" ? s.left : [];
const heavierPan = (s: BalanceScale) =>
  s.heavier === "left" ? s.left : s.heavier === "right" ? s.right : [];

/** Vật chưa từng ở đĩa nhẹ của cân nghiêng nào. */
function candidates(p: BalancePuzzle): number[] {
  const lifted = new Set(p.scales.flatMap(lighterPan));
  return p.items.map((_, i) => i).filter((i) => !lifted.has(i));
}

// ---------------------------------------------------------------------------
// Bộ kiểm "đúng một đáp án", độc lập với bộ sinh: chỉ đọc các cân, không đọc `weights`.
// ---------------------------------------------------------------------------

interface Relations {
  /** [x, y]: chắc chắn x nặng hơn y. */
  gt: [number, number][];
  /** [x, y]: chắc chắn x nặng bằng y. */
  eq: [number, number][];
}

/** Quan hệ chắc chắn đúng với MỌI bộ khối lượng dương khớp các cân. */
function relationsOf(scales: BalanceScale[]): Relations {
  const gt: [number, number][] = [];
  const eq: [number, number][] = [];
  for (const s of scales) {
    if (s.left.length === 1 && s.right.length === 1) {
      const l = s.left[0]!;
      const r = s.right[0]!;
      if (s.heavier === "left") gt.push([l, r]);
      else if (s.heavier === "right") gt.push([r, l]);
      else eq.push([l, r]);
    } else if (s.left.length === 1 || s.right.length === 1) {
      // Vật đơn thắng hoặc thăng bằng với nhiều vật → vật đơn nặng hơn từng vật bên kia.
      const singleOnLeft = s.left.length === 1;
      const single = (singleOnLeft ? s.left : s.right)[0]!;
      const others = singleOnLeft ? s.right : s.left;
      if (s.heavier === "equal" || s.heavier === (singleOnLeft ? "left" : "right")) {
        for (const o of others) gt.push([single, o]);
      }
    }
  }
  return { gt, eq };
}

const weakOrderCache = new Map<number, Int8Array[]>();

/** Mọi thứ tự yếu của n vật (cho phép bằng nhau): hạng 0 là nhóm nặng nhất. */
function weakOrders(n: number): Int8Array[] {
  const cached = weakOrderCache.get(n);
  if (cached) return cached;
  const out: Int8Array[] = [];
  const rank = new Int8Array(n);
  const visit = (i: number) => {
    if (i === n) {
      const used = new Array<boolean>(n).fill(false);
      for (const r of rank) used[r] = true;
      const levels = used.indexOf(false) === -1 ? n : used.indexOf(false);
      if (used.slice(levels).every((u) => !u)) out.push(rank.slice());
      return;
    }
    for (let r = 0; r < n; r++) {
      rank[i] = r;
      visit(i + 1);
    }
  };
  visit(0);
  weakOrderCache.set(n, out);
  return out;
}

/**
 * Duyệt mọi thứ tự yếu khớp các quan hệ: đúng một đáp án khi có ít nhất một thứ tự khớp
 * và trong mọi thứ tự khớp, nhóm nặng nhất chỉ gồm đúng vật `answer`.
 */
function hasUniqueHeaviest(n: number, scales: BalanceScale[], answer: number): boolean {
  const { gt, eq } = relationsOf(scales);
  let consistent = 0;
  for (const rank of weakOrders(n)) {
    if (!gt.every(([x, y]) => rank[x]! < rank[y]!)) continue;
    if (!eq.every(([x, y]) => rank[x] === rank[y])) continue;
    consistent++;
    if (rank[answer] !== 0) return false;
    for (let i = 0; i < n; i++) if (i !== answer && rank[i] === 0) return false;
  }
  return consistent > 0;
}

/** Bước suy luận ngắn nhất từ đáp án tới vật xa nhất (mỗi quan hệ ">" hoặc "=" là một bước). */
function proofDepth(p: BalancePuzzle): number {
  const n = p.items.length;
  const { gt, eq } = relationsOf(p.scales);
  const next: number[][] = Array.from({ length: n }, () => []);
  for (const [x, y] of gt) next[x]!.push(y);
  for (const [x, y] of eq) {
    next[x]!.push(y);
    next[y]!.push(x);
  }
  const dist = new Array<number>(n).fill(-1);
  dist[p.answer] = 0;
  const queue = [p.answer];
  for (let head = 0; head < queue.length; head++) {
    const x = queue[head]!;
    for (const y of next[x]!) {
      if (dist[y] === -1) {
        dist[y] = dist[x]! + 1;
        queue.push(y);
      }
    }
  }
  return dist.includes(-1) ? Number.POSITIVE_INFINITY : Math.max(...dist);
}

/** Mọi ràng buộc ở mục "Đảm bảo khi sinh câu đố" (trừ phân bố). Trả về lỗi đầu tiên. */
function violation(p: BalancePuzzle, d: Difficulty): string | null {
  const n = p.items.length;
  if (n !== ITEM_COUNT[d]) return `có ${n} vật`;
  if (p.weights.length !== n) return "weights không khớp items";
  if (new Set(p.items).size !== n) return "vật trùng nhau";
  if (!p.items.every((it) => (BALANCE_ITEMS as readonly string[]).includes(it))) {
    return "vật ngoài danh mục";
  }
  if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer >= n) return "answer ngoài khoảng";

  // Khối lượng: số nguyên 1–12, đáp án nặng nhất và không trùng vật nào.
  if (!p.weights.every((w) => Number.isInteger(w) && w >= 1 && w <= 12)) return "khối lượng sai";
  const top = p.weights[p.answer]!;
  if (p.weights.some((w, i) => i !== p.answer && w >= top)) return "đáp án không nặng nhất";

  // Cấu trúc theo bảng Độ khó.
  if (p.scales.length !== SCALE_COUNT[d]) return `có ${p.scales.length} cân`;
  const equalCount = p.scales.filter((s) => s.heavier === "equal").length;
  if (equalCount !== EQUAL_COUNT[d]) return `có ${equalCount} cân thăng bằng`;
  const doubleIdx = p.scales.flatMap((s, i) => (isDoublePan(s) ? [i] : []));
  if (doubleIdx.length !== DOUBLE_PAN_COUNT[d]) return `có ${doubleIdx.length} cân đĩa đôi`;
  if (doubleIdx.length > 0 && doubleIdx[0] !== p.scales.length - 1)
    return "cân đĩa đôi không ở cuối";

  const pairsSeen = new Set<number>();
  const onScale = new Set<number>();
  for (const s of p.scales) {
    const all = [...s.left, ...s.right];
    if (!all.every((x) => Number.isInteger(x) && x >= 0 && x < n)) return "chỉ số vật sai";
    if (new Set(all).size !== all.length) return "một vật xuất hiện hai lần trong một cân";
    if (isDoublePan(s)) {
      const sizes = [s.left.length, s.right.length].sort((a, b) => a - b);
      if (sizes[0] !== 1 || sizes[1] !== 2) return "cân đĩa đôi không phải 1 – 2";
      if (s.heavier !== "equal") return "cân đĩa đôi không thăng bằng";
    } else if (s.left.length !== 1 || s.right.length !== 1) {
      return "cân thường không phải 1 – 1";
    }
    for (const x of all) onScale.add(x);

    // Cân khớp khối lượng ẩn (so tổng hai đĩa).
    const sum = (pan: number[]) => pan.reduce((acc, i) => acc + p.weights[i]!, 0);
    const diff = sum(s.left) - sum(s.right);
    const actual = diff > 0 ? "left" : diff < 0 ? "right" : "equal";
    if (actual !== s.heavier) return "cân không khớp khối lượng";

    // Không cặp vật nào bị so hai lần.
    for (const l of s.left) {
      for (const r of s.right) {
        const key = Math.min(l, r) * n + Math.max(l, r);
        if (pairsSeen.has(key)) return "một cặp vật bị so hai lần";
        pairsSeen.add(key);
      }
    }

    // Đáp án không ở đĩa nhẹ; chỉ ở cân thăng bằng khi là vật đơn của cân đĩa đôi (Siêu khó).
    if (lighterPan(s).includes(p.answer)) return "đáp án ở đĩa nhẹ";
    if (s.heavier === "equal" && all.includes(p.answer)) {
      const single = s.left.length === 1 ? s.left : s.right;
      if (d !== 3 || !isDoublePan(s) || single[0] !== p.answer) {
        return "đáp án nằm trên cân thăng bằng";
      }
    }
  }
  if (onScale.size !== n) return "có vật không xuất hiện ở cân nào";

  // Độ khó tăng thật: số ứng viên còn lại sau khi loại vật bị nhấc.
  const cand = candidates(p);
  if (cand.length !== CANDIDATE_COUNT[d]) return `còn ${cand.length} ứng viên`;
  if (d === 3) {
    const double = p.scales[p.scales.length - 1]!;
    const pair = double.left.length === 2 ? double.left : double.right;
    const expected = [p.answer, ...pair].sort((a, b) => a - b);
    if (JSON.stringify([...cand].sort((a, b) => a - b)) !== JSON.stringify(expected)) {
      return "ứng viên Siêu khó không phải đáp án + hai vật của đĩa đôi";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

describe("balance: bộ kiểm độc lập", () => {
  it("đếm đủ số thứ tự yếu 13 / 75 / 541 / 4.683", () => {
    expect([3, 4, 5, 6].map((n) => weakOrders(n).length)).toEqual([13, 75, 541, 4_683]);
  });

  it("nhận ra câu mơ hồ", () => {
    // A > B và C > B: không biết A hay C nặng nhất.
    const scales: BalanceScale[] = [
      { left: [0], right: [1], heavier: "left" },
      { left: [1], right: [2], heavier: "right" },
    ];
    expect(hasUniqueHeaviest(3, scales, 0)).toBe(false);
    expect(hasUniqueHeaviest(3, scales, 2)).toBe(false);
    // Hai vật thắng một vật đơn: không suy ra được gì về từng vật.
    const trap: BalanceScale[] = [
      { left: [0], right: [1], heavier: "left" },
      { left: [1, 2], right: [0], heavier: "left" },
    ];
    expect(hasUniqueHeaviest(3, trap, 0)).toBe(false);
  });

  it("bốn ví dụ vẽ bản mẫu trong đặc tả là câu hợp lệ", () => {
    const examples: [Difficulty, BalancePuzzle][] = [
      [
        0,
        {
          items: ["banana", "watermelon", "apple"],
          scales: [
            { left: [2], right: [0], heavier: "left" },
            { left: [2], right: [1], heavier: "right" },
          ],
          weights: [2, 6, 4],
          answer: 1,
        },
      ],
      [
        1,
        {
          items: ["pear", "grapes", "apple", "carrot"],
          scales: [
            { left: [2], right: [0], heavier: "left" },
            { left: [3], right: [2], heavier: "right" },
            { left: [2], right: [1], heavier: "right" },
          ],
          weights: [3, 8, 6, 2],
          answer: 1,
        },
      ],
      [
        2,
        {
          items: ["pear", "mushroom", "grapes", "banana", "apple"],
          scales: [
            { left: [3], right: [4], heavier: "left" },
            { left: [0], right: [1], heavier: "left" },
            { left: [4], right: [0], heavier: "equal" },
            { left: [3], right: [2], heavier: "right" },
          ],
          weights: [5, 2, 9, 7, 5],
          answer: 2,
        },
      ],
      [
        3,
        {
          items: ["banana", "pear", "strawberry", "watermelon", "mushroom", "apple"],
          scales: [
            { left: [3], right: [1], heavier: "left" },
            { left: [4], right: [5], heavier: "right" },
            { left: [1], right: [2], heavier: "left" },
            { left: [2], right: [0], heavier: "right" },
            { left: [0, 5], right: [3], heavier: "equal" },
          ],
          weights: [3, 6, 1, 8, 4, 5],
          answer: 3,
        },
      ],
    ];
    for (const [d, p] of examples) {
      expect(violation(p, d), `ví dụ mức ${d}`).toBeNull();
      expect(hasUniqueHeaviest(p.items.length, p.scales, p.answer), `ví dụ mức ${d}`).toBe(true);
    }
  });
});

describe("balance: 10.000 seed × 4 độ khó", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    expectEvery((p, d, s) => {
      const again = balance.generate(roundSeedOf(s), indexOf(s), d);
      return JSON.stringify(again) === JSON.stringify(p) ? null : "sinh lại ra câu khác";
    });
  });

  it("cùng gốc: vật của mức thấp là phần đầu danh sách vật của mức cao", () => {
    expectEvery((p, d, s) => {
      if (d === 3) return null;
      const harder = puzzlesOf((d + 1) as Difficulty)[s]!;
      return JSON.stringify(harder.items.slice(0, p.items.length)) === JSON.stringify(p.items)
        ? null
        : "vật không cùng gốc";
    });
  });

  it("seed khác → câu khác (không sinh một câu cố định)", () => {
    for (const d of DIFFICULTIES) {
      const distinct = new Set(
        puzzlesOf(d)
          .slice(0, 200)
          .map((p) => JSON.stringify(p)),
      );
      expect(distinct.size).toBeGreaterThan(150);
    }
  });

  it("đúng MỘT đáp án: duyệt mọi thứ tự yếu khớp các cân", () => {
    expectEvery((p) =>
      hasUniqueHeaviest(p.items.length, p.scales, p.answer) ? null : "suy ra được hơn một đáp án",
    );
  });

  it("thoả mọi ràng buộc trong đặc tả (khối lượng, cấu trúc, vai đáp án, số ứng viên)", () => {
    expectEvery((p, d) => violation(p, d));
  });

  it("độ khó tăng thật: số bước suy luận và độ đánh lừa đúng như đặc tả", () => {
    for (const d of DIFFICULTIES) {
      const list = puzzlesOf(d);
      const depths = list.map(proofDepth);
      expect([Math.min(...depths), Math.max(...depths)], `mức ${d}`).toEqual(DEPTH_RANGE[d]);

      // Vật sai thắng nhiều cân nghiêng hơn vật đúng.
      const misleading = list.filter((p) => {
        const wins = new Array<number>(p.items.length).fill(0);
        for (const s of p.scales) for (const x of heavierPan(s)) wins[x]!++;
        return wins.some((w, i) => i !== p.answer && w > wins[p.answer]!);
      }).length;
      expect(Math.abs(misleading / list.length - WRONG_WINS_MORE[d]!), `mức ${d}`).toBeLessThan(
        0.02,
      );
    }
  });

  it("phân bố đều: vị trí đáp án, bên đĩa nặng, vai vật đơn ở Siêu khó", () => {
    let heavyLeft = 0;
    let tilted = 0;
    for (const d of DIFFICULTIES) {
      const list = puzzlesOf(d);
      const n = ITEM_COUNT[d]!;
      const byPosition = new Array<number>(n).fill(0);
      for (const p of list) {
        byPosition[p.answer]!++;
        for (const s of p.scales) {
          if (s.heavier === "equal") continue;
          tilted++;
          if (s.heavier === "left") heavyLeft++;
        }
      }
      for (const c of byPosition) expect(Math.abs(c / list.length - 1 / n)).toBeLessThan(0.02);
    }
    expect(Math.abs(heavyLeft / tilted - 0.5)).toBeLessThan(0.02);

    const hard = puzzlesOf(3);
    const singleIsAnswer = hard.filter((p) => {
      const double = p.scales[p.scales.length - 1]!;
      const single = double.left.length === 1 ? double.left : double.right;
      return single[0] === p.answer;
    }).length;
    expect(Math.abs(singleIsAnswer / hard.length - 0.5)).toBeLessThan(0.03);
  });

  it("check() nhận đúng đáp án và từ chối mọi ô khác", () => {
    expectEvery((p) => {
      for (let i = -1; i <= 6; i++) {
        if (balance.check(p, i) !== (i === p.answer)) return `check(${i}) sai`;
      }
      return null;
    });
  });

  it("speedAllowanceMs() hữu hạn, ≥ 0 và tất định", () => {
    const allowance = balance.speedAllowanceMs!;
    expectEvery((p, d, s) => {
      const ms = allowance(p, d);
      if (!Number.isFinite(ms) || ms < 0) return `miễn trừ ${ms}`;
      const again = allowance(balance.generate(roundSeedOf(s), indexOf(s), d), d);
      return again === ms && allowance(p, d) === ms ? null : "miễn trừ không tất định";
    });
  });
});

describe("balance: khai báo CR-006", () => {
  it("vòng 60 giây", () => {
    expect(balance.durationMs).toBe(60_000);
  });

  it("hệ số điểm dương, hữu hạn và không giảm khi lên mức", () => {
    const m = DIFFICULTIES.map((d) => balance.difficultyMultiplier![d]);
    for (const x of m) expect(Number.isFinite(x) && x > 0).toBe(true);
    expect(m).toEqual([...m].sort((a, b) => a - b));
  });

  it("miễn trừ chỉ bù cho Khó và Siêu khó, mức cao bù nhiều hơn", () => {
    const at = (d: Difficulty) => balance.speedAllowanceMs!(puzzlesOf(d)[0]!, d);
    expect(at(0)).toBe(0);
    expect(at(1)).toBe(0);
    expect(at(2)).toBeGreaterThan(0);
    expect(at(3)).toBeGreaterThan(at(2));
  });
});

describe("balance: isAnswer()", () => {
  it("nhận số nguyên 0 … 5", () => {
    for (let i = 0; i < 6; i++) expect(balance.isAnswer(i)).toBe(true);
  });

  it("từ chối dữ liệu rác", () => {
    const junk: unknown[] = [
      -1,
      6,
      100,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
      "0",
      "",
      true,
      null,
      undefined,
      [0],
      { index: 0 },
      0n,
    ];
    for (const v of junk) expect(balance.isAnswer(v), String(v)).toBe(false);
  });
});
