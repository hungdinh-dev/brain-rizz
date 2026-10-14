import { describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng } from "../../rng";
import {
  ISO_FLOOR,
  ISO_LEFT,
  ISO_NONE,
  ISO_RIGHT,
  ISO_TOP,
  isoCountInterpretations,
  isoHiddenTopHalves,
  isoPicture,
  isoVisibleTopHalves,
} from "./iso";
import { getPool4, getShiftPool, getTetrominoPlacements } from "./patterns";
import {
  generateTopView,
  TOP_VIEW_LEVELS,
  TOP_VIEW_MAX_CHOICES,
  type TopViewPuzzle,
  topView,
  topViewCubes,
} from "./top-view";

/*
 * Các phép kiểm hình học dưới đây viết lại độc lập với patterns.ts (lật, xoay, liền cạnh, loại hình),
 * và bộ vẽ isometric được kiểm với một bộ vẽ độc lập dùng toạ độ thật + đa giác + độ sâu theo tia nhìn.
 */
type G = number[][];

const SEEDS = 10_000;

const flipLR = (g: G): G => g.map((row) => [...row].reverse());
/** Xoay 90° theo chiều kim đồng hồ khi nhìn từ trên (mép trước ở dưới). */
const rotCW = (g: G): G => g[0]!.map((_, c) => g.map((row) => row[c]!).reverse());
const rotCCW = (g: G): G => rotCW(rotCW(rotCW(g)));
const same = (a: G, b: G) => JSON.stringify(a) === JSON.stringify(b);
const occ = (g: G): G => g.map((row) => row.map((v) => (v > 0 ? 1 : 0)));
const cellsOf = (g: G): [number, number][] =>
  g.flatMap((row, r) => row.flatMap((v, c): [number, number][] => (v > 0 ? [[c, r]] : [])));

function connected(g: G): boolean {
  const cells = cellsOf(g);
  if (cells.length === 0) return false;
  const key = (c: number, r: number) => `${c},${r}`;
  const all = new Set(cells.map(([c, r]) => key(c, r)));
  const seen = new Set([key(...cells[0]!)]);
  const queue = [cells[0]!];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const k = key(c + dc, r + dr);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([c + dc, r + dr]);
      }
    }
  }
  return seen.size === all.size;
}

/** 8 biến đổi của bệ, viết bằng tổ hợp lật/xoay ở trên. */
const symmetries = (g: G): G[] => {
  const out: G[] = [];
  let cur = g;
  for (let i = 0; i < 4; i++) {
    out.push(cur, flipLR(cur));
    cur = rotCW(cur);
  }
  return out;
};
const asymmetric = (g: G) => symmetries(g).filter((s) => same(s, g)).length === 1;

/** Khoá loại hình bất kể vị trí, xoay, lật (dịch về góc rồi lấy nhỏ nhất). */
function freeClass(g: G): string {
  const keys = symmetries(g).map((s) => {
    const cells = cellsOf(s);
    const mc = Math.min(...cells.map(([c]) => c));
    const mr = Math.min(...cells.map(([, r]) => r));
    return cells
      .map(([c, r]) => `${c - mc}:${r - mr}`)
      .sort()
      .join(" ");
  });
  return keys.sort()[0]!;
}
const CLASS_L = freeClass([
  [1, 0],
  [1, 0],
  [1, 1],
]);
const CLASS_T = freeClass([
  [1, 1, 1],
  [0, 1, 0],
]);
const CLASS_S = freeClass([
  [0, 1, 1],
  [1, 1, 0],
]);

// ---------------------------------------------------------------- Bộ vẽ isometric độc lập

/** Toạ độ màn hình (đơn vị: X nửa bề ngang khối, Y một phần tư chiều cao mặt trên) của điểm 3D. */
const proj = (c: number, r: number, z: number): [number, number] => [c - r, c + r - 2 * z];

interface Face {
  kind: number;
  poly: [number, number][];
  /** Độ sâu theo tia nhìn (1, 1, 1) tại điểm màn hình (x, y): càng lớn càng gần người nhìn. */
  depthAt: (x: number, y: number) => number;
}

function facesOf(h: G): Face[] {
  const n = h.length;
  const faces: Face[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // Mặt phẳng z = const: c + r = y + 2z, nên c + r + z = y + 3z.
      const flat = (z: number) => (_x: number, y: number) => y + 3 * z;
      faces.push({
        kind: ISO_FLOOR,
        poly: [proj(c, r, 0), proj(c + 1, r, 0), proj(c + 1, r + 1, 0), proj(c, r + 1, 0)],
        depthAt: flat(0),
      });
      for (let k = 0; k < h[r]![c]!; k++) {
        faces.push({
          kind: ISO_TOP,
          poly: [
            proj(c, r, k + 1),
            proj(c + 1, r, k + 1),
            proj(c + 1, r + 1, k + 1),
            proj(c, r + 1, k + 1),
          ],
          depthAt: flat(k + 1),
        });
        // Mặt trái nằm trên mặt phẳng r = r + 1: c = x + r', z = (c + r' − y) / 2.
        const rr = r + 1;
        faces.push({
          kind: ISO_LEFT,
          poly: [proj(c, rr, k + 1), proj(c + 1, rr, k + 1), proj(c + 1, rr, k), proj(c, rr, k)],
          depthAt: (x, y) => {
            const cc = x + rr;
            return cc + rr + (cc + rr - y) / 2;
          },
        });
        // Mặt phải nằm trên mặt phẳng c = c + 1: r = c' − x.
        const cc = c + 1;
        faces.push({
          kind: ISO_RIGHT,
          poly: [proj(cc, r, k + 1), proj(cc, r + 1, k + 1), proj(cc, r + 1, k), proj(cc, r, k)],
          depthAt: (x, y) => {
            const r2 = cc - x;
            return cc + r2 + (cc + r2 - y) / 2;
          },
        });
      }
    }
  }
  return faces;
}

function inside(poly: [number, number][], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Vẽ độc lập: lấy mẫu ở trọng tâm từng tam giác (X, Y, phía), chọn mặt gần nhất theo độ sâu thật
 * của điểm trúng trên tia nhìn. Trả về Map "X,Y,phía" → loại mặt (chỉ những chỗ có mặt).
 */
function rasterize(h: G): Map<string, number> {
  const out = new Map<string, { kind: number; depth: number }>();
  for (const f of facesOf(h)) {
    const xs = f.poly.map(([x]) => x);
    const ys = f.poly.map(([, y]) => y);
    for (let X = Math.min(...xs); X <= Math.max(...xs); X++) {
      for (let Y = Math.floor(Math.min(...ys)) - 2; Y <= Math.max(...ys); Y++) {
        if ((X + Y) % 2 !== 0) continue; // chỉ (X, Y) cùng chẵn lẻ mới là đỉnh lưới
        for (const side of [0, 1]) {
          const sx = side === 0 ? X - 1 / 3 : X + 1 / 3;
          const sy = Y + 1;
          if (!inside(f.poly, sx, sy)) continue;
          const depth = f.depthAt(sx, sy);
          const key = `${X},${Y},${side}`;
          const prev = out.get(key);
          if (!prev || depth > prev.depth + 1e-9) out.set(key, { kind: f.kind, depth });
        }
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, v.kind]));
}

/** Đọc lại bức vẽ của iso thành Map như `rasterize` (bố cục mảng mô tả trong iso.ts). */
function pictureMap(h: G): Map<string, number> {
  const n = h.length;
  const pic = isoPicture(h);
  const len = pic.length / (2 * n);
  const out = new Map<string, number>();
  for (let s = -(n - 1); s <= n; s++) {
    for (let i = 0; i < len; i++) {
      const k = pic[(s + n - 1) * len + i]!;
      if (k === ISO_NONE) continue;
      const side = i % 2;
      const y = Math.floor(i / 2) - 16;
      // Dải s: tam giác trái ở X = s, tam giác phải ở X = s − 1.
      out.set(`${side === 0 ? s : s - 1},${y},${side}`, k);
    }
  }
  return out;
}

/** Số nửa mặt trên (hoặc ô sàn) thấy được, theo bộ vẽ độc lập. */
function visibleHalvesRaster(h: G, raster: Map<string, number>, c: number, r: number): number {
  const z = h[r]![c]!;
  const [x, y] = proj(c, r, z);
  const want = z === 0 ? ISO_FLOOR : ISO_TOP;
  let seen = 0;
  // Mặt trên của ô (c, r) ở độ cao z: nửa trái (x, y, 0), nửa phải (x, y, 1). Kiểm độ sâu: mặt
  // phẳng z thấy ở đó thì loại mặt là `want`, nhưng còn cần đúng là mặt của cột này — dùng độ sâu.
  for (const side of [0, 1]) {
    if (raster.get(`${x},${y},${side}`) !== want) continue;
    // Cột cùng đường nhìn phía trước (c + k, r + k) cao z + k thì mặt trên của nó trùng chỗ này.
    let mine = true;
    for (let k = 1; c + k < h.length && r + k < h.length; k++) {
      if (h[r + k]![c + k]! >= z + k) mine = false;
    }
    if (mine) seen++;
  }
  return seen;
}

function randomHeights(rng: ReturnType<typeof createRng>, n: number, maxH: number): G {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => (rng.next() < 0.3 ? 0 : rng.int(1, maxH))),
  );
}

// ---------------------------------------------------------------- Kiểm một câu đố

const levelName = ["Mầm", "Thường", "Khó", "Siêu khó"];

function validate(p: TopViewPuzzle, d: Difficulty): string | undefined {
  const L = TOP_VIEW_LEVELS[d];
  const n = L.size;
  const h = p.heights;
  if (p.size !== n || h.length !== n || h.some((row) => row.length !== n)) return "cỡ bệ";
  if (h.flat().some((v) => !Number.isInteger(v) || v < 0 || v > L.maxHeight)) return "số tầng";
  if (Math.max(...h.flat()) !== L.maxHeight) return "thiếu cột cao nhất";
  const cols = cellsOf(h).length;
  if (cols < L.minColumns || cols > L.maxColumns) return `số cột ${cols}`;
  if (!connected(h)) return "hình chiếu không liền";
  const vis = isoVisibleTopHalves(h);
  for (const [c, r] of cellsOf(h)) if (vis[r]![c]! < 1) return `cột (${c},${r}) bị che kín`;
  if (isoCountInterpretations(h, L.maxHeight + 1) !== 1) return "hình vẽ hiểu được nhiều cách";
  if (p.showHeights !== L.showHeights) return "showHeights";
  if (p.choices.length !== L.choices) return "số lựa chọn";

  const expected = L.showHeights ? h : occ(h);
  const hits = p.choices.flatMap((ch, i) => (same(ch.grid, expected) ? [i] : []));
  if (hits.length !== 1 || hits[0] !== p.answerIndex) return "không đúng một đáp án";
  for (let i = 0; i < TOP_VIEW_MAX_CHOICES + 1; i++) {
    if (topView.check(p, i) !== (i === p.answerIndex)) return "check";
  }
  for (const ch of p.choices) {
    if (ch.grid.length !== n || ch.grid.some((row) => row.length !== n)) return "cỡ lưới lựa chọn";
    if (!L.showHeights && ch.grid.flat().some((v) => v !== 0 && v !== 1)) return "lưới 0/1";
    if (ch.grid.flat().some((v) => !Number.isInteger(v) || v < 0)) return "giá trị lưới";
  }
  for (let i = 0; i < p.choices.length; i++) {
    for (let j = i + 1; j < p.choices.length; j++) {
      if (same(p.choices[i]!.grid, p.choices[j]!.grid)) return "hai lựa chọn trùng nhau";
    }
  }
  if (p.choices[p.answerIndex]!.kind !== "answer") return "kind đáp án";
  const byKind = Object.fromEntries(p.choices.map((ch) => [ch.kind, ch.grid])) as Record<string, G>;
  const kinds = p.choices.map((ch) => ch.kind).sort();
  const ans = expected;

  if (d === 0) {
    if (JSON.stringify(kinds) !== JSON.stringify(["answer", "other", "other"])) return "kinds Mầm";
    const classes = p.choices.map((ch) => {
      if (cellsOf(ch.grid).length !== 4 || !connected(ch.grid)) return "x";
      return freeClass(ch.grid);
    });
    if ([...classes].sort().join("|") !== [CLASS_L, CLASS_T, CLASS_S].sort().join("|")) {
      return "Mầm phải đủ ba họ L, T, S";
    }
    return undefined;
  }
  if (!same(byKind.mirror!, flipLR(ans))) return "mirror";
  if (!asymmetric(occ(h))) return "hình chiếu đối xứng";
  if (d === 1) {
    if (
      JSON.stringify(kinds) !== JSON.stringify(["answer", "mirror", "shifted", "shifted-mirror"])
    ) {
      return "kinds Thường";
    }
    const s = byKind.shifted!;
    const diff = s.flat().filter((v, i) => v !== ans.flat()[i]).length;
    if (cellsOf(s).length !== cellsOf(ans).length || diff !== 2)
      return "shifted không phải dời 1 ô";
    if (!connected(s) || !asymmetric(s)) return "shifted không liền / đối xứng";
    if (!same(byKind["shifted-mirror"]!, flipLR(s))) return "shifted-mirror";
  }
  if (d === 2) {
    if (
      JSON.stringify(kinds) !== JSON.stringify(["answer", "mirror", "rotation", "rotation-mirror"])
    ) {
      return "kinds Khó";
    }
    const rot = byKind.rotation!;
    if (!same(rot, rotCW(h)) && !same(rot, rotCCW(h))) return "rotation không phải xoay 90°";
    if (!same(byKind["rotation-mirror"]!, flipLR(rot))) return "rotation-mirror";
  }
  if (d === 3) {
    if (
      JSON.stringify(kinds) !== JSON.stringify(["answer", "mirror", "swapped", "swapped-mirror"])
    ) {
      return "kinds Siêu khó";
    }
    const s = byKind.swapped!;
    const diffs: [number, number][] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (s[r]![c] !== h[r]![c]) diffs.push([c, r]);
    if (diffs.length !== 2) return "swapped phải khác đúng 2 ô";
    const [[c1, r1], [c2, r2]] = diffs as [[number, number], [number, number]];
    if (Math.abs(c1 - c2) + Math.abs(r1 - r2) !== 1) return "hai ô đổi không liền cạnh";
    if (s[r1]![c1] !== h[r2]![c2] || s[r2]![c2] !== h[r1]![c1]) return "không phải đổi chỗ";
    if (h[r1]![c1] === 0 || h[r2]![c2] === 0) return "đổi với ô trống";
    if (!same(byKind["swapped-mirror"]!, flipLR(s))) return "swapped-mirror";
  }
  // Khó, Siêu khó: mỗi lựa chọn sai, coi như một mô hình, phải vẽ ra khác mô hình thật.
  const pic = isoPicture(h).join(",");
  for (const ch of p.choices) {
    if (ch.kind !== "answer" && isoPicture(ch.grid).join(",") === pic)
      return "lựa chọn sai vẽ giống mô hình";
  }
  return undefined;
}

// ---------------------------------------------------------------- Test

/** 10 000 câu mỗi mức (index = seed mod 37), sinh một lần rồi dùng chung cho các test thống kê. */
const cache = new Map<Difficulty, TopViewPuzzle[]>();
function puzzles(d: Difficulty): TopViewPuzzle[] {
  let list = cache.get(d);
  if (!list) {
    list = Array.from({ length: SEEDS }, (_, seed) => topView.generate(seed, seed % 37, d));
    cache.set(d, list);
  }
  return list;
}

describe("top-view: kho hình chiếu", () => {
  it("số lượng và tính chất của kho", () => {
    const t = getTetrominoPlacements();
    expect([t.L.length, t.T.length, t.S.length]).toEqual([16, 8, 8]);
    const toGrid = (mask: number, n: number): G =>
      Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => ((mask >> (r * n + c)) & 1 ? 1 : 0)),
      );
    for (const [cls, ref] of [
      ["L", CLASS_L],
      ["T", CLASS_T],
      ["S", CLASS_S],
    ] as const) {
      for (const m of t[cls]) expect(freeClass(toGrid(m, 3))).toBe(ref);
    }
    for (const [k, size, moves] of [
      [5, 24, 164],
      [6, 32, 200],
    ] as const) {
      const pool = getShiftPool(k);
      expect(pool.length).toBe(size);
      expect(pool.reduce((a, p) => a + p.moves.length, 0)).toBe(moves);
      for (const { mask } of pool) {
        const g = toGrid(mask, 3);
        expect(connected(g) && asymmetric(g)).toBe(true);
      }
    }
    const sizes = [8, 9, 10, 11, 12, 13].map((k) => getPool4(k).length);
    expect(sizes).toEqual([1400, 1976, 2176, 1944, 1144, 448]);
    for (const k of [8, 13]) {
      for (const mask of getPool4(k)) {
        const g = toGrid(mask, 4);
        expect(cellsOf(g).length === k && connected(g) && asymmetric(g)).toBe(true);
      }
    }
  });
});

describe("top-view: hình học isometric", () => {
  it("khớp bộ vẽ độc lập (loại mặt từng tam giác, mặt trên lộ, công thức che khuất)", () => {
    const rng = createRng(2026);
    for (let t = 0; t < 1_500; t++) {
      const n = rng.int(3, 4);
      const h = randomHeights(rng, n, rng.int(1, 4));
      const raster = rasterize(h);
      expect(pictureMap(h)).toEqual(raster);
      const vis = isoVisibleTopHalves(h);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          expect(vis[r]![c]).toBe(visibleHalvesRaster(h, raster, c, r));
          if (h[r]![c]! > 0) expect(isoHiddenTopHalves(h, c, r, h[r]![c]!)).toBe(2 - vis[r]![c]!);
        }
      }
    }
  });

  it("topViewCubes cho đúng thứ tự vẽ: vẽ chồng lần lượt ra cùng hình với bộ vẽ độc lập", () => {
    const rng = createRng(77);
    for (let t = 0; t < 300; t++) {
      const n = rng.int(3, 4);
      const h = randomHeights(rng, n, 4);
      const painted = new Map<string, number>();
      const paint = (f: Face) => {
        const xs = f.poly.map(([x]) => x);
        const ys = f.poly.map(([, y]) => y);
        for (let X = Math.min(...xs); X <= Math.max(...xs); X++) {
          for (let Y = Math.floor(Math.min(...ys)) - 2; Y <= Math.max(...ys); Y++) {
            if ((X + Y) % 2 !== 0) continue;
            for (const side of [0, 1]) {
              if (inside(f.poly, side === 0 ? X - 1 / 3 : X + 1 / 3, Y + 1)) {
                painted.set(`${X},${Y},${side}`, f.kind);
              }
            }
          }
        }
      };
      const empty = h.map((row) => row.map(() => 0));
      for (const f of facesOf(empty)) paint(f);
      for (const { c, r, h: k } of topViewCubes(h)) {
        const one = h.map((row) => row.map(() => 0));
        one[r]![c] = 1;
        for (const f of facesOf(one).filter((f) => f.kind !== ISO_FLOOR)) {
          paint({ ...f, poly: f.poly.map(([x, y]): [number, number] => [x, y - 2 * k]) });
        }
      }
      expect(painted).toEqual(rasterize(h));
    }
  });

  it("đếm cách hiểu khớp vét cạn mọi bảng 3 × 3 cao ≤ 2", () => {
    const n = 3;
    const grids: G[] = [];
    const classes = new Map<string, number[]>();
    for (let code = 0; code < 3 ** 9; code++) {
      let x = code;
      const g: G = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => {
          const v = x % 3;
          x = Math.floor(x / 3);
          return v;
        }),
      );
      grids.push(g);
      const key = isoPicture(g).join("");
      const list = classes.get(key);
      if (list) list.push(code);
      else classes.set(key, [code]);
    }
    const allVisible = (g: G) => {
      const v = isoVisibleTopHalves(g);
      return cellsOf(g).every(([c, r]) => v[r]![c]! >= 1);
    };
    const rng = createRng(5);
    let ambiguous = 0;
    for (let t = 0; t < 1_500; t++) {
      const g = grids[rng.int(0, grids.length - 1)]!;
      const list = classes.get(isoPicture(g).join(""))!;
      const visibleCount = list.filter((code) => allVisible(grids[code]!)).length;
      expect(isoCountInterpretations(g, 2, 1_000, false)).toBe(list.length);
      expect(isoCountInterpretations(g, 2, 1_000, true)).toBe(visibleCount);
      if (allVisible(g) && visibleCount > 1) ambiguous++;
    }
    // Có những mô hình mọi cột đều lộ mặt trên mà vẫn hiểu được hai cách: bộ sinh phải loại chúng.
    expect(ambiguous).toBeGreaterThan(0);
  });
});

describe("top-view: sinh câu đố", () => {
  for (const d of DIFFICULTIES) {
    it(`${levelName[d]}: ${SEEDS} seed đều hợp lệ, đúng một đáp án`, () => {
      const position = new Array<number>(TOP_VIEW_MAX_CHOICES).fill(0);
      const errors: string[] = [];
      const list = puzzles(d);
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = list[seed]!;
        const err = validate(p, d);
        if (err && errors.length < 5) errors.push(`seed ${seed}: ${err}`);
        position[p.answerIndex]!++;
      }
      expect(errors).toEqual([]);
      // Không lộ đáp án qua vị trí: mỗi vị trí 1/n ± 2%.
      const k = TOP_VIEW_LEVELS[d].choices;
      for (let i = 0; i < k; i++) expect(Math.abs(position[i]! / SEEDS - 1 / k)).toBeLessThan(0.02);
    }, 120_000);
  }

  it("mô hình dự phòng (khi mọi lần thử đều hỏng) cũng hợp lệ", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        expect(validate(generateTopView(seed, seed % 7, d, 0), d)).toBeUndefined();
      }
    }
  });

  it("không lộ đáp án qua họ hình (Mầm) hay chiều xoay (Khó)", () => {
    const cls: Record<string, number> = {};
    let cw = 0;
    const N = SEEDS;
    for (let seed = 0; seed < N; seed++) {
      const p0 = puzzles(0)[seed]!;
      const c = freeClass(p0.choices[p0.answerIndex]!.grid);
      cls[c] = (cls[c] ?? 0) + 1;
      const p2 = puzzles(2)[seed]!;
      const rot = p2.choices.find((ch) => ch.kind === "rotation")!.grid;
      if (same(rot, rotCW(p2.heights))) cw++;
    }
    for (const c of [CLASS_L, CLASS_T, CLASS_S])
      expect(Math.abs(cls[c]! / N - 1 / 3)).toBeLessThan(0.02);
    expect(Math.abs(cw / N - 0.5)).toBeLessThan(0.02);
  }, 60_000);

  it("khó dần theo độ khó (đo được)", () => {
    const N = SEEDS;
    const stats = DIFFICULTIES.map((d) => {
      let cols = 0;
      let cubes = 0;
      let halfHidden = 0;
      for (let seed = 0; seed < N; seed++) {
        const p = puzzles(d)[seed]!;
        const vis = isoVisibleTopHalves(p.heights);
        for (const [c, r] of cellsOf(p.heights)) {
          cols++;
          cubes += p.heights[r]![c]!;
          if (vis[r]![c] === 1) halfHidden++;
        }
      }
      return {
        size: TOP_VIEW_LEVELS[d].size,
        choices: TOP_VIEW_LEVELS[d].choices,
        cols: cols / N,
        cubes: cubes / N,
        halfHidden: halfHidden / cols,
      };
    });
    const inc = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]!);
    const nonDec = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
    expect(nonDec(stats.map((s) => s.size))).toBe(true);
    expect(nonDec(stats.map((s) => s.choices))).toBe(true);
    expect(inc(stats.map((s) => s.cols))).toBe(true);
    expect(inc(stats.map((s) => s.cubes))).toBe(true);
    // Số liệu ghi trong đặc tả (mục Độ khó): cột/khối trung bình, tỉ lệ cột bị che nửa mặt trên.
    const near = (x: number, want: number, tol: number) => Math.abs(x - want) <= tol;
    expect(stats.map((s) => s.cols)).toEqual([
      4,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(
      near(stats[1]!.cols, 5.5, 0.1) &&
        near(stats[2]!.cols, 9, 0.1) &&
        near(stats[3]!.cols, 12, 0.1),
    ).toBe(true);
    expect([6.4, 12.4, 20.5, 36.3].every((want, d) => near(stats[d]!.cubes, want, 0.3))).toBe(true);
    expect(stats[3]!.halfHidden).toBeGreaterThan(stats[0]!.halfHidden);
  }, 60_000);

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố, kể cả khi nạp lại module", async () => {
    const first = DIFFICULTIES.map((d) =>
      Array.from({ length: 300 }, (_, s) => topView.generate(s * 7919, s % 23, d)),
    );
    vi.resetModules();
    const fresh = (await import("./top-view")).topView;
    for (const d of [...DIFFICULTIES].reverse()) {
      for (let s = 0; s < 300; s++) {
        const again = fresh.generate(s * 7919, s % 23, d);
        expect(again).toEqual(first[d]![s]);
        expect(topView.generate(s * 7919, s % 23, d)).toEqual(again);
      }
    }
    // Sửa câu đố đã trả về (kể cả câu dùng mô hình dự phòng) không ảnh hưởng câu sinh sau.
    for (const d of DIFFICULTIES) {
      for (const attempts of [40, 0]) {
        const a = generateTopView(1, 2, d, attempts);
        const before = JSON.stringify(a);
        for (const row of a.heights) row.fill(9);
        for (const ch of a.choices) for (const row of ch.grid) row.fill(9);
        expect(JSON.stringify(generateTopView(1, 2, d, attempts))).toBe(before);
      }
    }
  }, 60_000);

  it("mã băm đầu ra cố định (bắt mọi thay đổi vô tình của kho hay thứ tự gọi rng)", () => {
    const hashes = DIFFICULTIES.map((d) => {
      let hash = 0x811c9dc5;
      for (let s = 0; s < 200; s++) {
        const json = JSON.stringify(topView.generate(s, s % 5, d));
        for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 16777619);
      }
      return (hash >>> 0).toString(16);
    });
    expect(hashes).toEqual(["91aac20", "db14aaa1", "326443f1", "cc6594ef"]);
  }, 60_000);
});

describe("top-view: đáp án", () => {
  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const ok of [0, 1, 2, 3]) expect(topView.isAnswer(ok)).toBe(true);
    for (const bad of [-1, 4, 1.5, Number.NaN, "0", null, undefined, [0], { i: 0 }]) {
      expect(topView.isAnswer(bad)).toBe(false);
    }
  });

  it("hệ số độ khó tăng dần, Mầm ≤ 1", () => {
    const m = topView.difficultyMultiplier!;
    expect(m[0]).toBeLessThanOrEqual(1);
    expect(m[1]).toBe(1);
    expect(m[0] <= m[1] && m[1] <= m[2] && m[2] <= m[3]).toBe(true);
  });
});
