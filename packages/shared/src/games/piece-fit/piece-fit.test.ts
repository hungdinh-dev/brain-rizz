import { describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  PIECE_FIT_ANSWER_TURNS,
  PIECE_FIT_BOX_SIZE,
  PIECE_FIT_MAX_OPTIONS,
  PIECE_FIT_MAX_PIECE_SIDE,
  type PieceFitKind,
  type PieceFitPuzzle,
  pieceFit,
} from "./piece-fit";

/*
 * Các hàm hình học dưới đây viết lại độc lập với bộ sinh (bộ sinh dùng `rotate-match/shapes.ts`),
 * để test không dùng chung lỗi với bộ sinh. Xoay theo chiều kim đồng hồ trên màn hình (y hướng
 * xuống): (x, y) → (−y, x). "Dạng chuẩn xoay" = khoá nhỏ nhất trong 4 phép xoay (không lật).
 */
type Pt = readonly [number, number];
type Shape = readonly Pt[];

const SEEDS = 10_000;
const OPTIONS: Record<Difficulty, number> = { 0: 3, 1: 4, 2: 4, 3: 4 };

function norm(cells: Shape): Pt[] {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]): Pt => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

const key = (cells: Shape): string =>
  norm(cells)
    .map(([x, y]) => `${x}:${y}`)
    .join(" ");

function rot(cells: Shape, quarterTurns: number): Pt[] {
  let out: Pt[] = cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < ((quarterTurns % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
  return norm(out);
}

const flip = (cells: Shape): Pt[] => norm(cells.map(([x, y]) => [-x, y]));

/** Dạng chuẩn xoay: hai mảnh khớp nhau sau khi xoay ⇔ cùng dạng chuẩn. */
function rotKey(cells: Shape): string {
  const keys = [0, 1, 2, 3].map((r) => key(rot(cells, r)));
  return keys.reduce((a, b) => (b < a ? b : a));
}

/** Dạng chuẩn cả xoay lẫn lật. */
const freeKey = (cells: Shape): string => {
  const a = rotKey(cells);
  const b = rotKey(flip(cells));
  return a < b ? a : b;
};

/**
 * Hướng vẽ của mảnh: số lần xoay nhỏ nhất đưa dạng chuẩn xoay về đúng mảnh. Dùng để kiểm đáp án
 * không lộ qua tư thế vẽ trên thẻ.
 */
function pose(cells: Shape): number {
  const own = key(cells);
  const canon = rotKey(cells)
    .split(" ")
    .map((s): Pt => {
      const [x, y] = s.split(":").map(Number);
      return [x!, y!];
    });
  for (let r = 0; r < 4; r++) if (key(rot(canon, r)) === own) return r;
  return -1;
}

function connected(cells: Shape): boolean {
  const all = new Set(cells.map(([x, y]) => `${x}:${y}`));
  const stack: Pt[] = [cells[0]!];
  const seen = new Set([`${cells[0]![0]}:${cells[0]![1]}`]);
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const id = `${x + dx}:${y + dy}`;
      if (all.has(id) && !seen.has(id)) {
        seen.add(id);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === all.size;
}

const side = (cells: Shape): number => {
  const n = norm(cells);
  return Math.max(...n.map((c) => c[0]), ...n.map((c) => c[1])) + 1;
};

/** Có cách dịch `small` (giữ nguyên hướng) để mọi ô của nó nằm trong `big`. */
function containsAsIs(big: Shape, small: Shape): boolean {
  const b = new Set(norm(big).map(([x, y]) => `${x}:${y}`));
  const s = norm(small);
  for (let dx = -6; dx <= 6; dx++) {
    for (let dy = -6; dy <= 6; dy++) {
      if (s.every(([x, y]) => b.has(`${x + dx}:${y + dy}`))) return true;
    }
  }
  return false;
}

/** Số ô trùng nhiều nhất giữa `a` và một phép xoay + dịch của `b`. */
function maxOverlap(a: Shape, b: Shape): number {
  const set = new Set(norm(a).map(([x, y]) => `${x}:${y}`));
  let best = 0;
  for (let r = 0; r < 4; r++) {
    const rb = rot(b, r);
    for (let dx = -6; dx <= 6; dx++) {
      for (let dy = -6; dy <= 6; dy++) {
        let n = 0;
        for (const [x, y] of rb) if (set.has(`${x + dx}:${y + dy}`)) n++;
        if (n > best) best = n;
      }
    }
  }
  return best;
}

const isNormalized = (cells: Shape): boolean =>
  key(cells) === cells.map(([x, y]) => `${x}:${y}`).join(" ");

/** Index của câu theo seed, để thử cả nhiều chỉ số câu khác nhau. */
const indexOf = (seed: number): number => seed % 37;

/** FNV-1a 32 bit, dạng hex 8 ký tự. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Hai thẻ là bản lật gương của nhau (cùng số ô, lật một thẻ rồi xoay thì ra thẻ kia). */
const isMirrorPair = (a: Shape, b: Shape): boolean =>
  a.length === b.length && rotKey(flip(a)) === rotKey(b);

/** Số cặp thẻ là bản lật gương của nhau. */
function mirrorPairCount(p: PieceFitPuzzle): number {
  let pairs = 0;
  for (let i = 0; i < p.options.length; i++) {
    for (let j = i + 1; j < p.options.length; j++) {
      if (isMirrorPair(p.options[i]!.cells, p.options[j]!.cells)) pairs++;
    }
  }
  return pairs;
}

/** Từng thẻ có thuộc một cặp gương với thẻ khác không. */
const inMirrorPair = (p: PieceFitPuzzle): boolean[] =>
  p.options.map((o, i) => p.options.some((q, j) => j !== i && isMirrorPair(o.cells, q.cells)));

/** Kiểm một câu theo mục "Đảm bảo khi sinh câu đố" của đặc tả, trả danh sách lỗi (rỗng = đạt). */
function problems(p: PieceFitPuzzle, d: Difficulty): string[] {
  const errs: string[] = [];
  const n = p.gap.length;
  const box = PIECE_FIT_BOX_SIZE[d];
  const maxSide = PIECE_FIT_MAX_PIECE_SIDE[d];

  // Hộp và khoảng trống.
  if (p.box.cols !== box || p.box.rows !== box) errs.push("cỡ hộp");
  const expectedCells = d === 0 ? [3] : d === 1 ? [4] : d === 2 ? [5] : [5, 6];
  if (!expectedCells.includes(n)) errs.push(`khoảng trống ${n} ô`);
  if (!p.gap.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))) errs.push("ô lẻ");
  if (!p.gap.every(([x, y]) => x >= 0 && y >= 0 && x < p.box.cols && y < p.box.rows)) {
    errs.push("khoảng trống ra ngoài hộp");
  }
  if (new Set(p.gap.map(([x, y]) => `${x}:${y}`)).size !== n) errs.push("ô trống trùng");
  const sorted = [...p.gap].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (sorted.some((c, i) => c !== p.gap[i])) errs.push("khoảng trống chưa sắp");
  if (!connected(p.gap)) errs.push("khoảng trống không liền");
  if (side(p.gap) > maxSide) errs.push("khoảng trống quá to");

  // Thẻ: liền khối (4-kề), chuẩn hoá, nằm gọn trong khung bao chung của mức.
  if (p.options.length !== OPTIONS[d]) errs.push("số thẻ");
  for (const o of p.options) {
    if (!isNormalized(o.cells)) errs.push("thẻ chưa chuẩn hoá");
    if (new Set(o.cells.map(([x, y]) => `${x}:${y}`)).size !== o.cells.length) {
      errs.push("ô thẻ trùng");
    }
    if (!o.cells.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))) errs.push("ô lẻ");
    if (!connected(o.cells)) errs.push("thẻ không liền");
    if (side(o.cells) > maxSide) errs.push("thẻ quá to");
  }

  // Đúng MỘT đáp án theo dạng chuẩn xoay, đúng chỗ, đúng `kind`.
  const gapKey = rotKey(p.gap);
  const fits = p.options.flatMap((o, i) =>
    o.cells.length === n && rotKey(o.cells) === gapKey ? [i] : [],
  );
  if (fits.length !== 1) errs.push(`${fits.length} thẻ khớp`);
  if (fits[0] !== p.answerIndex) errs.push("answerIndex sai");
  const kinds = p.options.map((o) => o.kind);
  if (kinds.filter((k) => k === "fit").length !== 1 || kinds[p.answerIndex] !== "fit") {
    errs.push("kind fit");
  }
  for (let i = 0; i < PIECE_FIT_MAX_OPTIONS; i++) {
    if (pieceFit.check(p, i) !== (i === p.answerIndex)) errs.push(`check(${i}) sai`);
  }

  // Thẻ nhiễu không trùng dạng chuẩn xoay với nhau.
  const others = p.options.filter((_, i) => i !== p.answerIndex);
  if (new Set(others.map((o) => `${o.cells.length}|${rotKey(o.cells)}`)).size !== others.length) {
    errs.push("thẻ nhiễu trùng nhau");
  }

  // Góc xoay của đáp án theo mức.
  const answer = p.options[p.answerIndex]!.cells;
  if (!PIECE_FIT_ANSWER_TURNS[d].includes(p.answerTurns)) errs.push("answerTurns ngoài tập");
  if (key(rot(answer, p.answerTurns)) !== key(p.gap)) errs.push("answerTurns không khớp");
  const sameAsGap = key(answer) === key(p.gap);
  if (d === 0 ? !sameAsGap : sameAsGap) errs.push("hướng đáp án sai mức");

  // Không có mẹo đếm ô: đáp án không phải thẻ duy nhất có đúng số ô của khoảng trống.
  const sameCount = p.options.filter((o) => o.cells.length === n).length;
  if (sameCount !== { 0: 2, 1: 4, 2: 4, 3: 4 }[d]) errs.push(`${sameCount} thẻ cùng số ô`);

  // Loại thẻ nhiễu theo mức.
  const want: Record<Difficulty, PieceFitKind[]> = {
    0: ["fit", "other", "size"],
    1: ["fit", "other", "other", "other"],
    2: ["fit", "mirror", "other", "other"],
    3: ["fit", "mirror", "near", "other"],
  };
  if ([...kinds].sort().join() !== [...want[d]].sort().join()) errs.push(`bộ kind ${kinds}`);
  const ofKind = (k: PieceFitKind) => p.options.filter((o) => o.kind === k).map((o) => o.cells);
  const mirrorKey = rotKey(flip(p.gap));
  const mirrorPairs = mirrorPairCount(p);
  // Không có mẹo tìm cặp gương: hoặc không thẻ nào, hoặc mọi thẻ thuộc một cặp gương.
  const paired = inMirrorPair(p).filter(Boolean).length;
  if (paired !== 0 && paired !== p.options.length) errs.push(`${paired} thẻ thuộc cặp gương`);

  if (d === 0) {
    const [other] = ofKind("other");
    const [size] = ofKind("size");
    if (other?.length !== 3) errs.push("Mầm: mảnh khác không 3 ô");
    // Mảnh thừa một ô: chứa khoảng trống đúng hướng (trông như khoảng trống có thêm một ô).
    if (size?.length !== 4 || !connected(size) || !containsAsIs(size, p.gap)) {
      errs.push("Mầm: mảnh thừa");
    }
  }

  if (d === 1) {
    if (p.options.some((o) => rotKey(o.cells) === mirrorKey && mirrorKey !== gapKey)) {
      errs.push("Thường: có bản lật gương");
    }
    if (p.options.some((o) => o.cells.length !== 4)) errs.push("Thường: thẻ không 4 ô");
    // Không có cặp thẻ là bản lật gương của nhau (cặp gương sẽ lộ rằng cả hai đều sai).
    if (mirrorPairs !== 0) errs.push("Thường: có cặp gương");
  }

  if (d >= 2) {
    // Khoảng trống có tay thuận nên bản lật gương không bao giờ là đáp án thứ hai.
    if (mirrorKey === gapKey) errs.push("khoảng trống đối xứng gương");
    const [mir] = ofKind("mirror");
    if (mir === undefined || mir.length !== n || rotKey(mir) !== mirrorKey) {
      errs.push("bản lật gương");
    }
    // Cả 4 thẻ cùng số ô, đúng hai cặp gương: (đáp án, gương) và (W, gương của W).
    if (p.options.some((o) => o.cells.length !== n)) errs.push("thẻ khác số ô");
    if (mirrorPairs !== 2) errs.push(`${mirrorPairs} cặp gương`);
    if (d === 2) {
      // Khó: W là pentomino khác loại (cả khi tính lật), có tay thuận; hai thẻ "other" là gương
      // của nhau.
      const [w, w2] = ofKind("other");
      if (
        w === undefined ||
        w2 === undefined ||
        freeKey(w) === freeKey(p.gap) ||
        rotKey(w) === rotKey(flip(w)) ||
        rotKey(w2) !== rotKey(flip(w))
      ) {
        errs.push("Khó: cặp W");
      }
    } else {
      const [near] = ofKind("near");
      // Lệch 1 ô: liền khối, cùng số ô, trùng n − 1 ô với một phép xoay, khác loại (cả lật).
      if (
        near === undefined ||
        near.length !== n ||
        !connected(near) ||
        maxOverlap(p.gap, near) !== n - 1 ||
        freeKey(near) === freeKey(p.gap)
      ) {
        errs.push("mảnh lệch 1 ô");
      }
      const [other] = ofKind("other");
      if (other === undefined || near === undefined || rotKey(other) !== rotKey(flip(near))) {
        errs.push("Siêu khó: gương của mảnh lệch");
      }
      if (near !== undefined && rotKey(near) === rotKey(flip(near))) {
        errs.push("mảnh lệch đối xứng gương");
      }
    }
  }
  return errs;
}

describe("piece-fit: tất định", () => {
  it("cùng (seed, index, độ khó) → cùng câu đố; index khác → câu khác", () => {
    const seeds = [0, 1, 2, 77, 2026, 0x7fffffff, 0xffffffff];
    for (const d of DIFFICULTIES) {
      for (const seed of seeds) {
        for (let i = 0; i < 20; i++) {
          expect(pieceFit.generate(seed, i, d)).toEqual(pieceFit.generate(seed, i, d));
        }
      }
      const distinct = new Set(
        Array.from({ length: 30 }, (_, i) => JSON.stringify(pieceFit.generate(2026, i, d))),
      );
      expect(distinct.size).toBeGreaterThan(20);
    }
  });

  it("tất định cả khi nạp lại module và sinh theo thứ tự mức ngược lại", async () => {
    const before = DIFFICULTIES.map((d) => pieceFit.generate(4242, 7, d));
    vi.resetModules();
    const fresh = (await import("./piece-fit")).pieceFit;
    const after = [...DIFFICULTIES].reverse().map((d) => fresh.generate(4242, 7, d));
    expect(after.reverse()).toEqual(before);
  });

  it("sửa câu đố đã trả về không ảnh hưởng câu sinh sau", () => {
    for (const d of DIFFICULTIES) {
      const a = pieceFit.generate(99, 3, d);
      const snapshot = JSON.parse(JSON.stringify(a));
      (a.gap as [number, number][])[0]![0] = 99;
      for (const o of a.options) (o.cells as [number, number][])[0]![0] = 99;
      expect(pieceFit.generate(99, 3, d)).toEqual(snapshot);
    }
  });

  it("đầu ra cố định (bắt mọi thay đổi vô tình của kho hay thứ tự gọi rng)", () => {
    // Cố ý đổi bộ sinh (hoặc hàm hình học của rotate-match/shapes.ts) thì cập nhật các mã này.
    const hashes = DIFFICULTIES.map((d) =>
      fnv1a(
        Array.from({ length: 200 }, (_, i) => JSON.stringify(pieceFit.generate(2026, i, d))).join(
          "|",
        ),
      ),
    );
    expect(hashes).toEqual(["79b26d46", "34673f7c", "33d7aaa7", "8d3b83a6"]);
  });
});

describe("piece-fit: 10.000 seed mỗi mức", () => {
  it.each(DIFFICULTIES)(
    "mức %i: đúng luật, đúng MỘT đáp án, không lộ đáp án qua vị trí, tư thế vẽ hay cặp gương",
    (d) => {
      const failures: string[] = [];
      const answerAt = new Array<number>(OPTIONS[d]).fill(0);
      /** Theo tư thế vẽ: [số thẻ, số thẻ là đáp án]. Chỉ đếm mảnh không đối xứng xoay. */
      const byPose = [0, 1, 2, 3].map(() => [0, 0]);
      /** Theo "thuộc một cặp gương" (0 = không, 1 = có): [số thẻ, số thẻ là đáp án]. */
      const byPair = [0, 1].map(() => [0, 0]);
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = pieceFit.generate(seed, indexOf(seed), d);
        const errs = problems(p, d);
        if (errs.length > 0 && failures.length < 10)
          failures.push(`seed ${seed}: ${errs.join(", ")}`);
        answerAt[p.answerIndex]!++;
        const paired = inMirrorPair(p);
        p.options.forEach((o, i) => {
          const b = paired[i] ? 1 : 0;
          byPair[b]![0]!++;
          if (i === p.answerIndex) byPair[b]![1]!++;
          if (key(rot(o.cells, 2)) === key(o.cells)) return;
          const r = pose(o.cells);
          byPose[r]![0]!++;
          if (i === p.answerIndex) byPose[r]![1]!++;
        });
      }
      expect(failures).toEqual([]);
      // Vị trí: mỗi ô thẻ là đáp án 1/n ± 2 %.
      for (const h of answerAt) expect(Math.abs(h / SEEDS - 1 / OPTIONS[d])).toBeLessThan(0.02);
      // Tư thế vẽ: ở tư thế nào, tỉ lệ thẻ là đáp án cũng như nhau (± 3 %).
      const shares = byPose.map(([total, hits]) => hits! / total!);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.03);
      // Cặp gương: thẻ thuộc hay không thuộc một cặp gương đều là đáp án đúng 1/n ± 2 %.
      // Mầm, Thường không có cặp nào; Khó, Siêu khó mọi thẻ đều thuộc một cặp.
      expect(byPair.map(([total]) => total! > 0)).toEqual(d >= 2 ? [false, true] : [true, false]);
      for (const [total, hits] of byPair) {
        if (total! > 0) expect(Math.abs(hits! / total! - 1 / OPTIONS[d])).toBeLessThan(0.02);
      }
    },
    60_000,
  );

  it("dùng hết kho khoảng trống của mỗi mức (số mảnh khác nhau theo dạng chuẩn xoay)", () => {
    const counts = DIFFICULTIES.map((d) => {
      const bySize = new Map<number, Set<string>>();
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = pieceFit.generate(seed, indexOf(seed), d);
        if (!bySize.has(p.gap.length)) bySize.set(p.gap.length, new Set());
        bySize.get(p.gap.length)!.add(rotKey(p.gap));
      }
      return Object.fromEntries(
        [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v.size]),
      );
    });
    // Mầm: I, L 3 ô · Thường: 7 mảnh 4 ô trừ hình vuông · Khó: F, L, N, P, Y, Z 5 ô cả hai tay ·
    // Siêu khó: như Khó + mảnh 6 ô có tay thuận, khung ≤ 4, có mảnh lệch 1 ô có tay thuận.
    expect(counts).toEqual([{ 3: 2 }, { 4: 6 }, { 5: 12 }, { 5: 12, 6: 42 }]);
  }, 60_000);

  it("khó dần theo độ khó (đo trên 10 000 câu mỗi mức)", () => {
    const stats = DIFFICULTIES.map((d) => {
      let cells = 0;
      let options = 0;
      let rotated = 0;
      let halfTurn = 0;
      let mirrorTrap = 0;
      let nearTrap = 0;
      let sameSize = 0;
      let mirrorPairs = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = pieceFit.generate(seed, indexOf(seed), d);
        const n = p.gap.length;
        cells += n;
        options += p.options.length;
        if (p.answerTurns !== 0) rotated++;
        if (p.answerTurns === 2) halfTurn++;
        const others = p.options.filter((_, i) => i !== p.answerIndex);
        if (others.some((o) => o.cells.length === n && rotKey(o.cells) === rotKey(flip(p.gap)))) {
          mirrorTrap++;
        }
        if (others.some((o) => o.kind === "near")) nearTrap++;
        if (others.every((o) => o.cells.length === n)) sameSize++;
        mirrorPairs += mirrorPairCount(p);
      }
      return {
        cells: cells / SEEDS,
        options: options / SEEDS,
        rotated: rotated / SEEDS,
        halfTurn: halfTurn / SEEDS,
        mirrorTrap: mirrorTrap / SEEDS,
        nearTrap: nearTrap / SEEDS,
        sameSize: sameSize / SEEDS,
        mirrorPairs: mirrorPairs / SEEDS,
      };
    });
    const col = (k: keyof (typeof stats)[number]) => stats.map((s) => s[k]);
    // Số ô tăng hẳn; số thẻ, tỉ lệ phải xoay, bẫy gương, số cặp gương, mảnh lệch 1 ô, mọi thẻ
    // cùng số ô: không giảm.
    const cellsCol = col("cells");
    for (let i = 1; i < 4; i++) expect(cellsCol[i]!).toBeGreaterThan(cellsCol[i - 1]!);
    const monotone = [
      "options",
      "rotated",
      "mirrorTrap",
      "mirrorPairs",
      "nearTrap",
      "sameSize",
    ] as const;
    for (const k of monotone) expect(col(k)).toEqual([...col(k)].sort((a, b) => a - b));
    expect(col("options")).toEqual([3, 4, 4, 4]);
    expect(col("rotated")).toEqual([0, 1, 1, 1]);
    expect(col("mirrorTrap")).toEqual([0, 0, 1, 1]);
    // Khó, Siêu khó: hai cặp gương; chỉ Siêu khó có mảnh lệch 1 ô (W dựng từ khoảng trống).
    expect(col("mirrorPairs")).toEqual([0, 0, 2, 2]);
    expect(col("nearTrap")).toEqual([0, 0, 0, 1]);
    // Mầm có thẻ thừa một ô; từ Thường mọi thẻ cùng số ô.
    expect(col("sameSize")).toEqual([0, 1, 1, 1]);
    // Siêu khó có 5 và 6 ô gần ngang nhau.
    expect(Math.abs(cellsCol[3]! - 5.5)).toBeLessThan(0.03);
    // Thường có cả xoay 90° và 180°; Khó, Siêu khó có đủ 1–3 lượt xoay.
    expect(stats[1]!.halfTurn).toBeGreaterThan(0.2);
    for (const d of DIFFICULTIES) {
      const turns = new Set<number>();
      for (let seed = 0; seed < 500; seed++) turns.add(pieceFit.generate(seed, 0, d).answerTurns);
      expect([...turns].sort()).toEqual(PIECE_FIT_ANSWER_TURNS[d]);
    }
  }, 60_000);
});

describe("piece-fit: chấm và khai báo", () => {
  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const ok of [0, 1, 2, 3]) expect(pieceFit.isAnswer(ok)).toBe(true);
    const junk: unknown[] = [
      -1,
      4,
      99,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      "0",
      "1",
      "",
      null,
      undefined,
      true,
      false,
      {},
      [],
      [0],
      { index: 0 },
      1n,
      Object(1),
      () => 0,
    ];
    for (const value of junk) expect(pieceFit.isAnswer(value)).toBe(false);
  });

  it("Mầm: chạm thẻ thứ 4 (không tồn tại) thì sai", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(pieceFit.check(pieceFit.generate(seed, 0, 0), 3)).toBe(false);
    }
  });

  it("khai báo CR-006: vòng 60 giây, hệ số theo game, không miễn trừ tốc độ, không hạn trả lời", () => {
    expect(pieceFit.id).toBe("piece-fit");
    expect(pieceFit.category).toBe("visualize");
    expect(pieceFit.durationMs).toBe(60_000);
    expect(pieceFit.difficultyMultiplier).toEqual({ 0: 1, 1: 1, 2: 2, 3: 3.2 });
    expect(pieceFit.speedAllowanceMs).toBeUndefined();
    expect(pieceFit.answerWindowMs).toBeUndefined();
  });
});
