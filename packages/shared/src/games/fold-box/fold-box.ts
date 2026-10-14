import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";
import {
  AXES,
  apply,
  axisCode,
  type Cells,
  cross,
  eq,
  type Frame,
  fold,
  getLibrary,
  neg,
  orient,
  ROTATED_AXIS,
  ROTATIONS,
  upOf,
  type Vec3,
} from "./cube";

/**
 * Gấp hộp (nhóm Hình dung): trên cùng là một khối lập phương vẽ isometric, thấy 3 mặt (trên, trái,
 * phải). Người chơi chạm vào lưới trải phẳng duy nhất gấp được thành đúng khối đó.
 * Đặc tả: docs/04-minigames/fold-box.md.
 *
 * Bộ sinh dựng từng lựa chọn bằng cách gấp lưới thật (khung 3D cho từng ô), rồi tự kiểm lại mọi
 * lựa chọn với khối mẫu qua đủ 24 phép quay; `answerIndex` là lựa chọn duy nhất khớp.
 * Mọi thứ ngẫu nhiên đi qua `rng`.
 */

/**
 * Ký hiệu trên mặt: kem viền mực, phân biệt bằng HÌNH (không chỉ bằng màu).
 * - `dot` chấm, `ring` vòng, `plus` dấu cộng, `diamond` hình thoi: xoay 90° vẫn y hệt (không có hướng).
 * - `bar` sọc: xoay 180° y hệt, nên chỉ có ngang/dọc.
 * - `triangle` tam giác: có hướng, đỉnh chỉ về một trong 4 cạnh của mặt.
 */
export type FoldBoxSymbol = "dot" | "ring" | "plus" | "diamond" | "bar" | "triangle";

export const FOLD_BOX_SYMBOLS: readonly FoldBoxSymbol[] = [
  "dot",
  "ring",
  "plus",
  "diamond",
  "bar",
  "triangle",
];

/** Ký hiệu không có hướng (dùng ở Thường, và làm ký hiệu thứ ba / mặt khuất ở Khó, Siêu khó). */
const PLAIN_SYMBOLS: readonly FoldBoxSymbol[] = ["dot", "ring", "plus", "diamond"];

/**
 * Một ký hiệu trên một mặt (của khối hoặc ô lưới).
 * `rot`: số phần tư vòng xoay theo chiều kim đồng hồ (nhìn từ ngoài mặt) so với tư thế gốc.
 * Tư thế gốc: tam giác đỉnh chỉ LÊN (về −y của mặt); sọc NẰM NGANG (dọc theo x của mặt).
 * Đã chuẩn hoá: ký hiệu không hướng luôn 0; `bar` 0 (ngang) hoặc 1 (dọc); `triangle` 0–3.
 */
export interface FoldBoxMark {
  symbol: FoldBoxSymbol;
  rot: number;
}

/**
 * Khối mẫu: 3 mặt nhìn thấy, `null` là mặt trơn. Khung của từng mặt (để vẽ ký hiệu và `rot`) ở
 * mục Ghi chú cho FE của đặc tả: mặt trên x → phải-lên, y → phải-xuống; mặt trái x → phải-xuống,
 * y → xuống; mặt phải x → phải-lên, y → xuống.
 */
export interface FoldBoxCube {
  top: FoldBoxMark | null;
  left: FoldBoxMark | null;
  right: FoldBoxMark | null;
}

/** Một ô của lưới: `x`, `y` nguyên ≥ 0 (đơn vị ô, x sang phải, y xuống dưới), ký hiệu hoặc `null` (trơn). */
export interface FoldBoxCell {
  x: number;
  y: number;
  mark: FoldBoxMark | null;
}

/**
 * Lựa chọn là gì (FE chỉ dùng SAU khi chạm, để chọn phản hồi):
 * - `"answer"`: gấp được đúng khối mẫu.
 * - `"notNet"`: hình 6 ô không gấp được thành hộp (Mầm): hai ô `focus` chồng lên nhau.
 * - `"opposite"`: hai ký hiệu thấy được cùng lúc lại nằm ở hai mặt đối diện (hai ô `focus`).
 * - `"mirror"`: gấp ra bản soi gương của khối (trái ↔ phải). `focus` là hai ô bị đảo.
 * - `"rotated"`: đúng chỗ nhưng một ký hiệu có hướng bị xoay 90° (ô `focus`).
 */
export type FoldBoxChoiceKind = "answer" | "notNet" | "opposite" | "mirror" | "rotated";

export interface FoldBoxChoice {
  /** 6 ô, đã chuẩn hoá (x, y nhỏ nhất bằng 0), sắp theo (y, x). Khung bao ≤ 5 × 3 hoặc 3 × 5. */
  cells: FoldBoxCell[];
  kind: FoldBoxChoiceKind;
  /**
   * Chỉ số ô (trong `cells`) cần khoanh khi hiện phản hồi. Đáp án: 3 ô thành mặt trên/trái/phải
   * (theo thứ tự đó; Mầm để rỗng vì khối trơn). Mồi: các ô gây sai như mô tả ở `kind`.
   */
  focus: number[];
}

export interface FoldBoxPuzzle {
  cube: FoldBoxCube;
  /** 3 lựa chọn (Mầm) hoặc 4, theo thứ tự ô trên màn hình (trái → phải, trên → dưới). */
  choices: FoldBoxChoice[];
  answerIndex: number;
}

/** Đáp án = chỉ số lựa chọn người chơi chạm (số nguyên 0–3). */
export type FoldBoxAnswer = number;

export const FOLD_BOX_MAX_CHOICES = 4;

// ─── Khung 3 mặt nhìn thấy (toạ độ của khối mẫu) ─────────────────────────────

/** Trái = +x, phải = +y, trên = +z (trái × phải = trên). */
const TOP: Frame = { n: [0, 0, 1], ex: [-1, 0, 0], ey: [0, 1, 0] };
const LEFT: Frame = { n: [1, 0, 0], ex: [0, 1, 0], ey: [0, 0, -1] };
const RIGHT: Frame = { n: [0, 1, 0], ex: [-1, 0, 0], ey: [0, 0, -1] };
const VISIBLE: readonly Frame[] = [TOP, LEFT, RIGHT];
const VISIBLE_CODES: readonly number[] = VISIBLE.map((f) => axisCode(f.n));
/** Ba mặt khuất, thứ tự cố định. */
const HIDDEN: readonly Vec3[] = [
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, -1],
];

/** Một ký hiệu đặt trên khối 3D: mặt `n`, hướng "lên" `up` (vuông góc với `n`). */
interface Placed {
  n: Vec3;
  symbol: FoldBoxSymbol;
  up: Vec3;
}

type Model = Placed[];

function at(model: Model, n: Vec3): Placed | undefined {
  return model.find((p) => eq(p.n, n));
}

/** Hai hướng "lên" trông như nhau với ký hiệu này. */
function sameLook(symbol: FoldBoxSymbol, a: Vec3, b: Vec3): boolean {
  if (symbol === "triangle") return eq(a, b);
  if (symbol === "bar") return eq(a, b) || eq(a, neg(b));
  return true;
}

function normRot(symbol: FoldBoxSymbol, rot: number): number {
  if (symbol === "triangle") return rot;
  if (symbol === "bar") return rot % 2;
  return 0;
}

/** Một hướng nằm trên mặt `n`, chọn theo `k` (0–3). */
function tangent(n: Vec3, k: number): Vec3 {
  const list = AXES.filter((a) => a[0] * n[0] + a[1] * n[1] + a[2] * n[2] === 0);
  return list[k]!;
}

// ─── Kiểm bằng cách gấp thật ─────────────────────────────────────────────────

/**
 * Gấp lưới rồi thử đủ 24 phép quay. Trả về các bộ [ô trên, ô trái, ô phải] của mọi phép quay làm
 * 3 mặt nhìn thấy trông y hệt khối mẫu. Rỗng nếu lưới không gấp được hoặc không khớp.
 */
export function foldBoxMatches(cells: readonly FoldBoxCell[], cube: FoldBoxCube): number[][] {
  const folded = fold(cells.map((c) => [c.x, c.y] as const));
  if (!folded.ok) return [];
  const faces = [cube.top, cube.left, cube.right];
  const codes = folded.frames.map((f) => axisCode(f.n));
  const cellOf: number[] = [];
  const out: number[][] = [];
  ROTATIONS.forEach((q, qi) => {
    // Sau phép quay q, ô i nằm ở mặt có mã ROTATED_AXIS[qi][codes[i]].
    codes.forEach((c, i) => {
      cellOf[ROTATED_AXIS[qi]![c]!] = i;
    });
    const hit: number[] = [];
    for (let v = 0; v < 3; v++) {
      const frame = VISIBLE[v]!;
      const want = faces[v]!;
      const i = cellOf[VISIBLE_CODES[v]!]!;
      const have = cells[i]!.mark;
      if (have === null || want === null) {
        if (have !== want) break;
      } else if (
        have.symbol !== want.symbol ||
        !sameLook(want.symbol, apply(q, upOf(folded.frames[i]!, have.rot)), upOf(frame, want.rot))
      ) {
        break;
      }
      hit.push(i);
    }
    if (hit.length === 3) out.push(hit);
  });
  return out;
}

// ─── Dựng lựa chọn ───────────────────────────────────────────────────────────

interface Built {
  cells: FoldBoxCell[];
  /** Mặt (toạ độ khối mẫu) mà từng ô rơi vào sau khi gấp và quay. */
  faceOf: Vec3[];
}

/** Đặt khối `model` lên lưới `shape` (tư thế ngẫu nhiên), xoay khối theo một phép quay ngẫu nhiên. */
function place(rng: Rng, shape: Cells, model: Model): Built {
  const cellsXY = orient(shape, rng.int(0, 7));
  const folded = fold(cellsXY);
  if (!folded.ok) throw new Error("fold-box: lưới không gấp được");
  const q = rng.pick(ROTATIONS);
  const faceOf = folded.frames.map((f) => apply(q, f.n));
  const cells = cellsXY.map(([x, y], i): FoldBoxCell => {
    const p = at(model, faceOf[i]!);
    if (!p) return { x, y, mark: null };
    const frame = folded.frames[i]!;
    // Tìm rot để hướng "lên" của ký hiệu trên ô, sau khi gấp và quay, trùng hướng trong khối.
    let rot = 0;
    for (let r = 0; r < 4; r++) {
      if (sameLook(p.symbol, apply(q, upOf(frame, r)), p.up)) {
        rot = r;
        break;
      }
    }
    return { x, y, mark: { symbol: p.symbol, rot: normRot(p.symbol, rot) } };
  });
  return { cells, faceOf };
}

function cellsAt(built: Built, normals: readonly Vec3[]): number[] {
  return normals.map((n) => built.faceOf.findIndex((f) => eq(f, n)));
}

/** Bản soi gương qua mặt phẳng x = y: đổi trái ↔ phải. */
function mirrorModel(model: Model): Model {
  const m = (v: Vec3): Vec3 => [v[1], v[0], v[2]];
  return model.map((p) => ({ n: m(p.n), symbol: p.symbol, up: m(p.up) }));
}

/** Xoay ký hiệu ở mặt `n` đi 90° (chiều theo `sign`). */
function rotateModel(model: Model, n: Vec3, sign: number): Model {
  return model.map((p) => {
    if (!eq(p.n, n)) return p;
    const up = cross(p.n, p.up);
    return { ...p, up: sign > 0 ? up : neg(up) };
  });
}

/**
 * Chuyển ký hiệu ở mặt `b` sang mặt đối diện của `a`; thứ đang ở đó (ký hiệu khuất hoặc trơn)
 * chuyển về `b`. Kết quả: ký hiệu ở `a` và ở `b` cũ nằm đối diện nhau.
 */
function oppositeModel(rng: Rng, model: Model, a: Vec3, b: Vec3): Model {
  const target = neg(a);
  const kUp = rng.int(0, 3);
  const kBack = rng.int(0, 3);
  return model.map((p) => {
    if (eq(p.n, b)) return { ...p, n: target, up: tangent(target, kUp) };
    if (eq(p.n, target)) return { ...p, n: b, up: tangent(b, kBack) };
    return p;
  });
}

function mark(symbol: FoldBoxSymbol, rot: number): FoldBoxMark {
  return { symbol, rot: normRot(symbol, rot) };
}

interface Variant {
  model: Model;
  kind: FoldBoxChoiceKind;
  /** Mặt (toạ độ khối mẫu) cần khoanh khi phản hồi. */
  focus: Vec3[];
}

function buildMarked(rng: Rng, difficulty: Difficulty): { cube: FoldBoxCube; variants: Variant[] } {
  // 1. Ký hiệu cho 3 mặt nhìn thấy.
  let symbols: FoldBoxSymbol[];
  let extra: FoldBoxSymbol = "dot";
  if (difficulty === 1) {
    symbols = rng.shuffle(PLAIN_SYMBOLS).slice(0, 3);
  } else {
    extra = rng.pick(PLAIN_SYMBOLS);
    symbols = rng.shuffle<FoldBoxSymbol>(["triangle", "bar", extra]);
  }
  const marks = symbols.map((s) =>
    mark(s, s === "triangle" ? rng.int(0, 3) : s === "bar" ? rng.int(0, 1) : 0),
  );
  const cube: FoldBoxCube = { top: marks[0]!, left: marks[1]!, right: marks[2]! };
  const model: Model = VISIBLE.map((f, v) => ({
    n: f.n,
    symbol: marks[v]!.symbol,
    up: upOf(f, marks[v]!.rot),
  }));

  // 2. Siêu khó: 3 mặt khuất cũng có ký hiệu (3 ký hiệu không hướng còn lại).
  if (difficulty === 3) {
    const rest = rng.shuffle(PLAIN_SYMBOLS.filter((s) => s !== extra));
    HIDDEN.forEach((n, i) => {
      model.push({ n, symbol: rest[i]!, up: tangent(n, 0) });
    });
  }

  const visibleN = VISIBLE.map((f) => f.n);
  const answer: Variant = { model, kind: "answer", focus: visibleN };
  const faceOfSymbol = (s: FoldBoxSymbol): Vec3 => VISIBLE[symbols.indexOf(s)]!.n;

  // 3. Mồi.
  const opposite = (pair: number): Variant => {
    // Cặp mặt thấy được (a, b); ngẫu nhiên ký hiệu nào bị dời sang đối diện ký hiệu kia.
    const [i, j] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ][pair]!;
    const swap = rng.int(0, 1) === 1;
    const a = visibleN[swap ? j! : i!]!;
    const b = visibleN[swap ? i! : j!]!;
    return { model: oppositeModel(rng, model, a, b), kind: "opposite", focus: [a, neg(a)] };
  };
  const rotated = (s: FoldBoxSymbol): Variant => {
    const n = faceOfSymbol(s);
    return {
      model: rotateModel(model, n, rng.int(0, 1) === 1 ? 1 : -1),
      kind: "rotated",
      focus: [n],
    };
  };
  const mirror = (): Variant => ({
    model: mirrorModel(model),
    kind: "mirror",
    focus: [LEFT.n, RIGHT.n],
  });

  let decoys: Variant[];
  if (difficulty === 1) {
    decoys = [opposite(0), opposite(1), opposite(2)];
  } else if (difficulty === 2) {
    decoys = [mirror(), rotated(rng.int(0, 1) === 1 ? "triangle" : "bar"), opposite(rng.int(0, 2))];
  } else {
    decoys = [mirror(), rotated("triangle"), rotated("bar")];
  }
  return { cube, variants: [answer, ...decoys] };
}

/** Xếp lựa chọn và lấy đáp án bằng cách gấp thật từng lựa chọn. */
function finish(rng: Rng, cube: FoldBoxCube, list: FoldBoxChoice[]): FoldBoxPuzzle {
  const choices = rng.shuffle(list);
  const answerIndex = choices.findIndex((c) => foldBoxMatches(c.cells, cube).length > 0);
  return { cube, choices, answerIndex };
}

export const foldBox: MinigameDef<FoldBoxPuzzle, FoldBoxAnswer> = {
  id: "fold-box",
  category: "visualize",
  // CR-006: vòng 60 giây cho game mới, để Siêu khó vẫn còn ≥ 8 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mô phỏng ở mục Cân bằng của đặc tả. Mầm = min(mô phỏng trẻ 7 tuổi, 1).
  difficultyMultiplier: { 0: 0.85, 1: 1, 2: 1.95, 3: 3.25 },
  // Không khai báo `speedAllowanceMs`: không có pha trình chiếu, một chạm là xong.

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const lib = getLibrary();

    if (difficulty === 0) {
      // Mầm: khối trơn; 1 lưới gấp được + 1 hình có hàng 5 ô + 1 hình có khối 2 × 2.
      const cube: FoldBoxCube = { top: null, left: null, right: null };
      const plain = (shape: Cells, kind: FoldBoxChoiceKind): FoldBoxChoice => {
        const xy = orient(shape, rng.int(0, 7));
        const folded = fold(xy);
        return {
          cells: xy.map(([x, y]) => ({ x, y, mark: null })),
          kind,
          focus: folded.ok ? [] : [...folded.clash],
        };
      };
      return finish(rng, cube, [
        plain(rng.pick(lib.nets), "answer"),
        plain(rng.pick(lib.runs), "notNet"),
        plain(rng.pick(lib.blocks), "notNet"),
      ]);
    }

    const { cube, variants } = buildMarked(rng, difficulty);
    // Mỗi lựa chọn một dáng lưới khác nhau.
    const shapes = rng.shuffle(lib.nets).slice(0, variants.length);
    const list = variants.map((v, i): FoldBoxChoice => {
      const built = place(rng, shapes[i]!, v.model);
      return { cells: built.cells, kind: v.kind, focus: cellsAt(built, v.focus) };
    });
    return finish(rng, cube, list);
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is FoldBoxAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < FOLD_BOX_MAX_CHOICES
    );
  },
};
