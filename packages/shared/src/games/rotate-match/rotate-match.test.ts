import { describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  ROTATE_MATCH_ANGLES,
  ROTATE_MATCH_MAX_CHOICES,
  ROTATE_MATCH_MAX_RADIUS,
  type RotateMatchFigure,
  type RotateMatchPuzzle,
  rotateMatch,
} from "./rotate-match";
import { getPool } from "./shapes";

/*
 * Các hàm hình học dưới đây viết lại độc lập với shapes.ts (cách xoay, chuẩn hoá khác), để
 * test không dùng chung lỗi với bộ sinh. Xoay theo chiều kim đồng hồ trên màn hình (y hướng
 * xuống): (x, y) → (−y, x).
 */
type Pt = readonly [number, number];
type Shape = readonly Pt[];

const SEEDS = 10_000;
const CELLS: Record<Difficulty, number> = { 0: 4, 1: 5, 2: 6, 3: 7 };

/**
 * Khoá so sánh hình bất kể vị trí: dịch về gốc rồi bật bit (y·8 + x) của từng ô, nên không phụ
 * thuộc thứ tự ô. Hình rộng/cao từ 8 ô trở lên (không hợp lệ ở game này) dùng khoá chuỗi.
 */
function key(cells: Shape): string {
  let mx = Number.POSITIVE_INFINITY;
  let my = Number.POSITIVE_INFINITY;
  for (const [x, y] of cells) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  let lo = 0;
  let hi = 0;
  for (const [x, y] of cells) {
    const dx = x - mx;
    const dy = y - my;
    if (dx >= 8 || dy >= 8) {
      return cells
        .map(([cx, cy]) => `${cx - mx}:${cy - my}`)
        .sort()
        .join(" ");
    }
    const bit = dy * 8 + dx;
    if (bit < 32) lo |= 1 << bit;
    else hi |= 1 << (bit - 32);
  }
  return `${lo >>> 0}.${hi >>> 0}`;
}

function rot(cells: Shape, quarterTurns: number): Pt[] {
  let out: Pt[] = cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < ((quarterTurns % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
  return out;
}

const flip = (cells: Shape): Pt[] => cells.map(([x, y]) => [-x, y]);
const sameShape = (a: Shape, b: Shape) => key(a) === key(b);

/**
 * Khoá của 4 phép xoay (`rot[k]` = xoay k × 90°) và 4 phép lật rồi xoay (`mir[k]`).
 * Chỉ phụ thuộc hình nên ghi nhớ theo khoá, để 40 000 câu kiểm nhanh.
 */
const orbitCache = new Map<string, { rot: string[]; mir: string[] }>();
function orbit(cells: Shape): { rot: string[]; mir: string[] } {
  const k = key(cells);
  let o = orbitCache.get(k);
  if (o === undefined) {
    const turns = [0, 1, 2, 3];
    o = {
      rot: turns.map((r) => key(rot(cells, r))),
      mir: turns.map((r) => key(rot(flip(cells), r))),
    };
    orbitCache.set(k, o);
  }
  return o;
}

/** b là a sau một phép xoay 90° nào đó (kể cả 0°). */
const isRotation = (a: Shape, b: Shape) => orbit(a).rot.includes(key(b));
/** b là a sau khi lật gương rồi xoay. */
const isMirrorImage = (a: Shape, b: Shape) => orbit(a).mir.includes(key(b));
const sameClass = (a: Shape, b: Shape) => isRotation(a, b) || isMirrorImage(a, b);

/** Hai hình VẼ RA trông y hệt nhau: trùng nhau sau khi áp góc vẽ (góc lệch phải là bội 90°). */
function looksSame(a: RotateMatchFigure, b: RotateMatchFigure): boolean {
  const d = (((b.angle - a.angle) % 360) + 360) % 360;
  if (d % 90 !== 0) return false;
  return orbit(b.cells).rot[d / 90] === key(a.cells);
}

/** Vẽ hình thành chữ "#. / ##" (sau khi chuẩn hoá) để so với ví dụ trong đặc tả. */
function render(cells: Shape): string {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  const w = Math.max(...cells.map((c) => c[0])) - mx + 1;
  const h = Math.max(...cells.map((c) => c[1])) - my + 1;
  const filled = new Set(cells.map(([x, y]) => `${x - mx}:${y - my}`));
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) row += filled.has(`${x}:${y}`) ? "#" : ".";
    rows.push(row);
  }
  return rows.join(" / ");
}

function connected(cells: Shape): boolean {
  const all = new Set(cells.map(([x, y]) => `${x}:${y}`));
  const first = cells[0]!;
  const seen = new Set([`${first[0]}:${first[1]}`]);
  const queue: Pt[] = [first];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const id = `${nx}:${ny}`;
      if (all.has(id) && !seen.has(id)) {
        seen.add(id);
        queue.push([nx, ny]);
      }
    }
  }
  return seen.size === all.size;
}

/** Có ô trống trong khung bao không đi ra được mép khung (lỗ). */
function hasHoleIndependent(cells: Shape): boolean {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  const filled = new Set(cells.map(([x, y]) => `${x}:${y}`));
  const outside = new Set<string>();
  const queue: Pt[] = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (onEdge && !filled.has(`${x}:${y}`)) {
        outside.add(`${x}:${y}`);
        queue.push([x, y]);
      }
    }
  }
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const id = `${nx}:${ny}`;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || filled.has(id) || outside.has(id)) continue;
      outside.add(id);
      queue.push([nx, ny]);
    }
  }
  return outside.size + filled.size < w * h;
}

function radius(cells: Shape): number {
  const cx = cells.reduce((s, c) => s + c[0] + 0.5, 0) / cells.length;
  const cy = cells.reduce((s, c) => s + c[1] + 0.5, 0) / cells.length;
  let r = 0;
  for (const [x, y] of cells) {
    for (const [px, py] of [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ] as const) {
      r = Math.max(r, Math.sqrt((px - cx) ** 2 + (py - cy) ** 2));
    }
  }
  return r;
}

/** Tập khoá (chuẩn theo vị trí, cả 8 biến đổi) của mọi hình thu được khi dời đúng một ô. */
const oneMoveCache = new Map<string, Set<string>>();
function oneMoveKeys(cells: Shape): Set<string> {
  const cacheKey = key(cells);
  const cached = oneMoveCache.get(cacheKey);
  if (cached) return cached;
  const out = new Set<string>();
  cells.forEach((removed, i) => {
    const rest = cells.filter((_, j) => j !== i);
    if (!connected(rest)) return;
    const taken = new Set(rest.map(([x, y]) => `${x}:${y}`));
    for (const [x, y] of rest) {
      for (const e of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (taken.has(`${e[0]}:${e[1]}`) || (e[0] === removed[0] && e[1] === removed[1])) continue;
        const moved = [...rest, e];
        for (let k = 0; k < 4; k++) {
          out.add(key(rot(moved, k)));
          out.add(key(rot(flip(moved), k)));
        }
      }
    }
  });
  oneMoveCache.set(cacheKey, out);
  return out;
}

const isOneMoveFrom = (from: Shape, to: Shape) => oneMoveKeys(from).has(key(to));

const L4: Shape = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
];
const T4: Shape = [
  [0, 0],
  [1, 0],
  [2, 0],
  [1, 1],
];
const S4: Shape = [
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
];

/** Băm FNV-1a 32 bit, để bắt mọi thay đổi vô tình trong kho hình hay thứ tự gọi rng. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("rotate-match: kho hình", () => {
  it("kích thước kho đúng 3 / 5 / 17 / 54", () => {
    expect(DIFFICULTIES.map((d) => getPool(d).length)).toEqual([3, 5, 17, 54]);
  });

  it("kho Mầm là đúng ba họ L, T, S", () => {
    const pool = getPool(0);
    for (const ref of [L4, T4, S4]) {
      expect(pool.filter((c) => sameClass(c.cells, ref))).toHaveLength(1);
    }
  });

  it.each(DIFFICULTIES)("mức %i: mọi loại trong kho thoả ràng buộc của đặc tả", (d) => {
    const pool = getPool(d);
    pool.forEach((c, i) => {
      expect(c.cells).toHaveLength(CELLS[d]);
      expect(connected(c.cells)).toBe(true);
      expect(hasHoleIndependent(c.cells)).toBe(false);
      const w = Math.max(...c.cells.map((p) => p[0])) + 1;
      const h = Math.max(...c.cells.map((p) => p[1])) + 1;
      if (d === 0) expect([Math.min(w, h), Math.max(w, h)]).toEqual([2, 3]);
      expect(Math.max(w, h)).toBeLessThanOrEqual(4);
      // Không hai loại trong kho là cùng một hình.
      for (let j = 0; j < i; j++) expect(sameClass(c.cells, pool[j]!.cells)).toBe(false);
      if (d >= 1) {
        // Có tay thuận và không đối xứng xoay.
        expect(isRotation(c.cells, flip(c.cells))).toBe(false);
        for (const k of [1, 2, 3]) expect(sameShape(rot(c.cells, k), c.cells)).toBe(false);
        // Hình gần giống: có, đúng là dời một ô, khác loại, đối xứng hai chiều.
        expect(c.near.length).toBeGreaterThan(0);
        for (const j of c.near) {
          expect(j).not.toBe(i);
          expect(isOneMoveFrom(c.cells, pool[j]!.cells)).toBe(true);
          expect(pool[j]!.near).toContain(i);
        }
        // Đủ: mọi loại trong kho dời được một ô từ loại này đều có trong danh sách.
        const expected = pool
          .map((other, j) => (j !== i && isOneMoveFrom(c.cells, other.cells) ? j : -1))
          .filter((j) => j >= 0);
        expect([...c.near]).toEqual(expected);
      }
    });
  });

  it("số hình gần giống mỗi loại: Thường 4, Khó 7–13, Siêu khó 9–31", () => {
    const range = (d: Difficulty) => {
      const counts = getPool(d).map((c) => c.near.length);
      return [Math.min(...counts), Math.max(...counts)];
    };
    expect(range(1)).toEqual([4, 4]);
    expect(range(2)).toEqual([7, 13]);
    expect(range(3)).toEqual([9, 31]);
  });

  it("ROTATE_MATCH_MAX_RADIUS là bán kính lớn nhất của kho, làm tròn lên 0,01", () => {
    for (const d of DIFFICULTIES) {
      const max = Math.max(...getPool(d).map((c) => radius(c.cells)));
      expect(Math.ceil(max * 100 - 1e-9) / 100).toBe(ROTATE_MATCH_MAX_RADIUS[d]);
    }
  });

  it("chiều xoay khớp ví dụ trong đặc tả (góc dương = chiều kim đồng hồ)", () => {
    expect(render(rot(L4, 1))).toBe("### / #..");
    expect(render(rot(T4, 2))).toBe(".#. / ###");
    expect(render(rot(S4, 1))).toBe("#. / ## / .#");
    const f5: Shape = [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ];
    expect(render(rot(f5, 3))).toBe("#.. / ### / .#.");
  });
});

describe("rotate-match: tất định", () => {
  it("cùng (seed, index, độ khó) → cùng câu đố; index khác → câu khác", () => {
    for (const d of DIFFICULTIES) {
      expect(rotateMatch.generate(777, 5, d)).toEqual(rotateMatch.generate(777, 5, d));
      const distinct = new Set(
        Array.from({ length: 100 }, (_, i) => JSON.stringify(rotateMatch.generate(777, i, d))),
      );
      expect(distinct.size).toBeGreaterThan(80);
    }
  });

  it("không phụ thuộc thứ tự gọi hay kho đã ghi nhớ (nạp lại module, đi ngược các mức)", async () => {
    const before = DIFFICULTIES.map((d) =>
      Array.from({ length: 200 }, (_, s) => JSON.stringify(rotateMatch.generate(s, s % 7, d))),
    );
    vi.resetModules();
    const fresh = (await import("./rotate-match")).rotateMatch;
    expect(fresh).not.toBe(rotateMatch);
    for (const d of [...DIFFICULTIES].reverse()) {
      const after = Array.from({ length: 200 }, (_, s) =>
        JSON.stringify(fresh.generate(s, s % 7, d)),
      );
      expect(after).toEqual(before[d]);
    }
  });

  it("sửa câu đố đã trả về không làm đổi câu đố sau", () => {
    for (const d of DIFFICULTIES) {
      const p = rotateMatch.generate(42, 3, d);
      const copy: RotateMatchPuzzle = JSON.parse(JSON.stringify(p));
      for (const fig of [p.model, ...p.choices]) {
        (fig.cells as unknown as number[][]).forEach((c) => {
          c[0] = 99;
        });
        (fig.cells as unknown[]).push([9, 9]);
      }
      expect(rotateMatch.generate(42, 3, d)).toEqual(copy);
    }
  });

  it("đầu ra cố định (đổi kho hình hay thứ tự gọi rng là đổi câu đố của mọi seed)", () => {
    // Nếu CỐ Ý đổi bộ sinh, cập nhật các mã băm này và ghi lại trong đặc tả.
    const hashes = DIFFICULTIES.map((d) =>
      fnv1a(
        Array.from({ length: 200 }, (_, i) =>
          JSON.stringify(rotateMatch.generate(2026, i, d)),
        ).join("|"),
      ),
    );
    expect(hashes).toEqual(["0d703c62", "827693ca", "7dd3bbd4", "457adfad"]);
  });
});

interface LevelStats {
  /** Số câu có đáp án ở từng vị trí. */
  answerAt: number[];
  /** Theo góc: [số lựa chọn ở góc đó, số lựa chọn ở góc đó là đáp án]. */
  byAngle: Map<number, [number, number]>;
  /** Số lựa chọn nghiêng (góc không chia hết cho 90°) và tổng số lựa chọn. */
  tilted: number;
  choices: number;
}

const newStats = (): LevelStats => ({ answerAt: [], byAngle: new Map(), tilted: 0, choices: 0 });

function record(p: RotateMatchPuzzle, s: LevelStats): void {
  s.answerAt[p.answerIndex] = (s.answerAt[p.answerIndex] ?? 0) + 1;
  p.choices.forEach((c, i) => {
    const entry = s.byAngle.get(c.angle) ?? [0, 0];
    entry[0]++;
    if (i === p.answerIndex) entry[1]++;
    s.byAngle.set(c.angle, entry);
    if (c.angle % 90 !== 0) s.tilted++;
    s.choices++;
  });
}

/** Liền, không lỗ, bán kính ≤ ROTATE_MATCH_MAX_RADIUS. Chỉ phụ thuộc hình nên ghi nhớ theo khoá. */
const shapeIssueCache = new Map<string, string | null>();
function shapeIssue(cells: Shape, d: Difficulty): string | null {
  const cacheKey = `${d}|${key(cells)}`;
  let issue = shapeIssueCache.get(cacheKey);
  if (issue === undefined) {
    issue = !connected(cells)
      ? "ô không liền"
      : hasHoleIndependent(cells)
        ? "hình có lỗ"
        : radius(cells) > ROTATE_MATCH_MAX_RADIUS[d]
          ? "bán kính vượt ROTATE_MATCH_MAX_RADIUS"
          : null;
    shapeIssueCache.set(cacheKey, issue);
  }
  return issue;
}

/**
 * Kiểm đầy đủ một câu đố theo mục "Đảm bảo khi sinh câu đố" của đặc tả. Trả về danh sách lỗi
 * (rỗng là đạt). Không gọi `expect` từng điều kiện để 40 000 câu chạy nhanh.
 */
function verifyPuzzle(p: RotateMatchPuzzle, d: Difficulty): string[] {
  const errors: string[] = [];
  const need = (ok: boolean, what: string) => {
    if (!ok) errors.push(what);
  };
  const n = d === 0 ? 3 : 4;
  const angles = ROTATE_MATCH_ANGLES[d];
  const { model, choices, answerIndex } = p;

  need(choices.length === n, `số lựa chọn ${choices.length} ≠ ${n}`);
  need(
    Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < choices.length,
    `answerIndex ${answerIndex} ngoài khoảng`,
  );
  if (errors.length > 0) return errors;
  need(model.angle === 0, "góc hình mẫu ≠ 0");

  // Hình hợp lệ: ô nguyên ≥ 0, đã chuẩn hoá, sắp (y, x), không trùng, liền, không lỗ, khung ≤ 4.
  for (const fig of [model, ...choices]) {
    const cells = fig.cells;
    need(cells.length === CELLS[d], `số ô ${cells.length} ≠ ${CELLS[d]}`);
    need(
      cells.every(
        ([x, y]) =>
          Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && !Object.is(x, -0),
      ),
      "ô không phải số nguyên ≥ 0",
    );
    need(
      Math.min(...cells.map((c) => c[0])) === 0 && Math.min(...cells.map((c) => c[1])) === 0,
      "ô chưa chuẩn hoá",
    );
    for (let i = 1; i < cells.length; i++) {
      const [ax, ay] = cells[i - 1]!;
      const [bx, by] = cells[i]!;
      need(ay < by || (ay === by && ax < bx), "ô chưa sắp theo (y, x) hoặc bị trùng");
    }
    need(
      Math.max(...cells.map((c) => c[0])) <= 3 && Math.max(...cells.map((c) => c[1])) <= 3,
      "khung bao > 4",
    );
    const issue = shapeIssue(cells, d);
    if (issue !== null) errors.push(issue);
  }

  // Góc: không 0°, thuộc tập góc của mức.
  for (const c of choices) need(angles.includes(c.angle), `góc ${c.angle} ngoài tập góc`);

  // ĐÚNG MỘT bản xoay của mẫu (kiểm độc lập), là answerIndex, kind "rotation".
  const rotations = choices.flatMap((c, i) => (isRotation(model.cells, c.cells) ? [i] : []));
  need(
    rotations.length === 1 && rotations[0] === answerIndex,
    `bản xoay ở [${rotations}], answerIndex ${answerIndex}`,
  );
  choices.forEach((c, i) => {
    need((c.kind === "rotation") === (i === answerIndex), `kind "rotation" sai chỗ (${i})`);
  });
  // Đáp án có đúng các ô của mẫu, chỉ khác góc vẽ.
  need(key(choices[answerIndex]!.cells) === key(model.cells), "đáp án khác ô với mẫu");

  // Không lộ: đáp án không trông y hệt mẫu; không hai lựa chọn trông giống nhau.
  need(!looksSame(model, choices[answerIndex]!), "đáp án trông y hệt hình mẫu");
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      need(!looksSame(choices[i]!, choices[j]!), `lựa chọn ${i} và ${j} trông giống nhau`);
    }
  }

  if (d === 0) {
    // Mầm: hai mồi khác họ với mẫu và khác họ nhau; ba lựa chọn phủ đủ L, T, S.
    need(choices.filter((c) => c.kind === "other").length === 2, "Mầm phải có 2 mồi khác họ");
    for (const ref of [L4, T4, S4]) {
      need(choices.filter((c) => sameClass(c.cells, ref)).length === 1, "Mầm không đủ L, T, S");
    }
    return errors;
  }

  // Mẫu có tay thuận và không đối xứng xoay.
  need(!isRotation(model.cells, flip(model.cells)), "mẫu không có tay thuận");
  need(
    [1, 2, 3].every((k) => !sameShape(rot(model.cells, k), model.cells)),
    "mẫu đối xứng xoay",
  );

  const mirrors = choices.filter((c) => c.kind === "mirror");
  const others = choices.filter((c) => c.kind === "other");
  need(mirrors.length === 1 && others.length === 2, "phải có 1 bản gương và 2 hình khác");
  if (errors.length > 0) return errors;
  // "mirror" đúng là gương của mẫu (không phải bản xoay: đã kiểm ở trên).
  need(isMirrorImage(model.cells, mirrors[0]!.cells), '"mirror" không phải gương của mẫu');
  // "other": khác loại với mẫu, là hình gần giống (mẫu dời đúng một ô).
  for (const o of others) {
    need(!sameClass(model.cells, o.cells), '"other" cùng loại với mẫu');
    need(isOneMoveFrom(model.cells, o.cells), '"other" không phải mẫu dời một ô');
  }
  // Hai "other" là gương của nhau (cùng một hình Q).
  need(isMirrorImage(others[0]!.cells, others[1]!.cells), "hai hình khác không là cặp gương");
  // Đúng 2 cặp gương, không cặp nào là bản xoay của nhau.
  let mirrorPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      need(!isRotation(choices[i]!.cells, choices[j]!.cells), `${i} và ${j} là bản xoay`);
      if (isMirrorImage(choices[i]!.cells, choices[j]!.cells)) mirrorPairs++;
    }
  }
  need(mirrorPairs === 2, `${mirrorPairs} cặp gương, cần đúng 2`);
  return errors;
}

describe("rotate-match: 10.000 seed mỗi mức", () => {
  it.each(DIFFICULTIES)(
    "mức %i: tất định, đúng một đáp án, check đúng/sai, đủ mọi ràng buộc",
    (d) => {
      const s = newStats();
      const failures: string[] = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const index = seed % 37;
        const p = rotateMatch.generate(seed, index, d);
        const errors = verifyPuzzle(p, d);
        if (JSON.stringify(rotateMatch.generate(seed, index, d)) !== JSON.stringify(p)) {
          errors.push("không tất định");
        }
        // check nhận đúng đáp án, từ chối mọi lựa chọn khác (kể cả chỉ số 3 ở Mầm).
        for (let i = 0; i < ROTATE_MATCH_MAX_CHOICES; i++) {
          if (rotateMatch.check(p, i) !== (i === p.answerIndex)) errors.push(`check(${i}) sai`);
        }
        if (errors.length > 0 && failures.length < 20) {
          failures.push(`seed ${seed}: ${errors.join("; ")}`);
        }
        record(p, s);
      }
      expect(failures).toEqual([]);

      // Không lộ đáp án qua vị trí: mỗi vị trí là đáp án 1/n ± 2%.
      const n = d === 0 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        expect(Math.abs((s.answerAt[i] ?? 0) / SEEDS - 1 / n)).toBeLessThan(0.02);
      }
      // Từ Thường, không lộ qua góc: ở mỗi góc, 25% ± 2% lựa chọn ở góc đó là đáp án.
      if (d >= 1) {
        expect([...s.byAngle.keys()].sort((a, b) => a - b)).toEqual(ROTATE_MATCH_ANGLES[d]);
        for (const [total, answers] of s.byAngle.values()) {
          expect(Math.abs(answers / total - 0.25)).toBeLessThan(0.02);
        }
      }
    },
    60_000,
  );

  it("độ khó tăng dần, đo được (2 000 seed mỗi mức)", () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const metrics = DIFFICULTIES.map((d) => {
      const s = newStats();
      const cellCounts = new Set<number>();
      const choiceCounts = new Set<number>();
      for (let seed = 0; seed < 2_000; seed++) {
        const p = rotateMatch.generate(seed, 3, d);
        cellCounts.add(p.model.cells.length);
        choiceCounts.add(p.choices.length);
        record(p, s);
      }
      return {
        cells: [...cellCounts],
        choices: [...choiceCounts],
        poolSize: getPool(d).length,
        angleStep: [...s.byAngle.keys()].reduce(gcd),
        tiltedRatio: s.tilted / s.choices,
      };
    });
    expect(metrics.map((m) => m.cells)).toEqual([[4], [5], [6], [7]]);
    expect(metrics.map((m) => m.choices)).toEqual([[3], [4], [4], [4]]);
    expect(metrics.map((m) => m.poolSize)).toEqual([3, 5, 17, 54]);
    expect(metrics.map((m) => m.angleStep)).toEqual([90, 90, 45, 30]);
    const tilted = metrics.map((m) => m.tiltedRatio);
    expect(tilted[0]).toBe(0);
    expect(tilted[1]).toBe(0);
    expect(Math.abs(tilted[2]! - 2 / 3)).toBeLessThan(0.03);
    expect(tilted[3]).toBe(1);
  });
});

describe("rotate-match: chấm và kiểm kiểu", () => {
  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const ok of [0, 1, 2, 3]) expect(rotateMatch.isAnswer(ok)).toBe(true);
    const junk: unknown[] = [
      -1,
      4,
      99,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
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
    for (const value of junk) expect(rotateMatch.isAnswer(value)).toBe(false);
  });

  it("khai báo CR-006: vòng 60 giây, hệ số theo game, không có miễn trừ tốc độ", () => {
    expect(rotateMatch.durationMs).toBe(60_000);
    expect(rotateMatch.difficultyMultiplier).toEqual({ 0: 0.85, 1: 1, 2: 2, 3: 3.3 });
    expect(rotateMatch.speedAllowanceMs).toBeUndefined();
  });
});
