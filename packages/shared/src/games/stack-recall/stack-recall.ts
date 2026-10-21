import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Xếp lại tháp (nhóm Ghi nhớ): một tháp khối hiện vài giây rồi bị khăn lau che; chạm các khối ở
 * khay theo đúng thứ tự từ DƯỚI lên để xếp lại tháp. Mầm không cần đúng thứ tự, Khó có tầng lặp
 * loại, Siêu khó xáo khay mỗi câu.
 * Đặc tả: docs/04-minigames/stack-recall.md.
 */

/**
 * Bộ khối (8 loại). Scene không vẽ chữ: FE ánh xạ loại sang hình. Mỗi loại khác mọi loại khác ở
 * CẢ hình lẫn hoa văn; màu chỉ là gợi ý phụ, nên người mù màu vẫn phân biệt được.
 * Mức có K loại dùng K loại đầu, nên 4 hình dễ gọi tên nhất (tròn, vuông, tam giác, sao) đứng đầu
 * cho Mầm. Thứ tự ở đây cũng là thứ tự khay ở Mầm, Thường, Khó (khay cố định).
 */
export const STACK_RECALL_KINDS = [
  { shape: "circle", pattern: "plain" },
  { shape: "square", pattern: "stripes" },
  { shape: "triangle", pattern: "dots" },
  { shape: "star", pattern: "checker" },
  { shape: "heart", pattern: "diagonal" },
  { shape: "moon", pattern: "zigzag" },
  { shape: "drop", pattern: "waves" },
  { shape: "cross", pattern: "bricks" },
] as const;

export type StackRecallShape = (typeof STACK_RECALL_KINDS)[number]["shape"];
export type StackRecallPattern = (typeof STACK_RECALL_KINDS)[number]["pattern"];

/** Loại khối = chỉ số trong `STACK_RECALL_KINDS` (số nguyên 0–7). */
export type StackRecallKind = number;

/**
 * Câu đố. Lịch (ms, tính từ lúc câu hiện ra): tháp hiện trong `showMs`, khăn lau che trong
 * `coverMs`, rồi chỉ còn các ô tầng trống. Người chơi được chạm từ `stackRecallRevealMs(puzzle)`;
 * trước đó mọi lần chạm bị bỏ qua, không tính sai.
 */
export interface StackRecallPuzzle {
  /**
   * Các tầng từ DƯỚI lên TRÊN (`layers[0]` là tầng đáy). Dài 2–5. Hai tầng liền nhau không bao
   * giờ cùng loại. Mầm, Thường: các tầng đôi một khác loại. Khó, Siêu khó: nửa số câu có đúng một
   * loại xuất hiện hai lần (không liền nhau), nửa còn lại đôi một khác loại.
   */
  layers: StackRecallKind[];
  /**
   * Khay, theo thứ tự ô (trái → phải, trên → dưới). Mỗi loại đúng một lần, chạm bao nhiêu lần cũng
   * được. Mầm, Thường, Khó: K loại đầu của `STACK_RECALL_KINDS` theo đúng thứ tự (cố định);
   * Siêu khó: cả 8 loại, xáo lại mỗi câu. Mọi loại của `layers` đều có trên khay.
   */
  tray: StackRecallKind[];
  /**
   * true = phải chạm đúng thứ tự từ dưới lên (Thường, Khó, Siêu khó). false = chỉ cần chạm đủ các
   * khối của tháp, thứ tự nào cũng được (Mầm).
   */
  ordered: boolean;
  /** true = khay xáo chỗ mỗi câu (chỉ Siêu khó). Scene hiện huy hiệu xáo khay. */
  trayShuffled: boolean;
  /** Thời gian tháp hiện rõ (ms), tính từ lúc câu hiện ra. */
  showMs: number;
  /** Thời gian khăn lau che tháp (ms), ngay sau `showMs`. */
  coverMs: number;
}

/**
 * Đáp án = các loại khối đã chạm ở khay, theo thứ tự chạm. Client gửi MỘT lần mỗi câu:
 * - chạm đủ `layers.length` khối, lần nào cũng đúng → gửi cả mảng;
 * - lần chạm sai đầu tiên → gửi ngay mảng tính tới khối sai (vd. `[2, 0, 4]`).
 * "Đúng" xét bằng `stackRecallOnTrack`. Chạm lại đúng loại vừa chạm ngay trước đó thì client bỏ
 * qua (tháp không bao giờ có hai tầng liền nhau cùng loại), không thêm vào mảng.
 */
export type StackRecallAnswer = StackRecallKind[];

interface LevelParams {
  /** Số tầng N. */
  layers: number;
  /** Số loại trên khay K. */
  kinds: number;
  /** Phải đúng thứ tự từ dưới lên. */
  ordered: boolean;
  /** Có thể có một loại lặp (nửa số câu). */
  repeats: boolean;
  /** Khay xáo chỗ mỗi câu. */
  shuffleTray: boolean;
  showMs: number;
}

const COVER_MS = 400;

/** Phụ cấp thưởng tốc độ cho mỗi lần chạm sau lần đầu (ms): thời gian tối thiểu để tìm và chạm. */
const TAP_ALLOWANCE_MS = 300;

/** Số lần rút lại tối đa khi tháp trùng tháp câu kề bên (xác suất hết lượt < 1e-15). */
const MAX_REDRAWS = 32;

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: { layers: 2, kinds: 4, ordered: false, repeats: false, shuffleTray: false, showMs: 2_500 },
  1: { layers: 3, kinds: 5, ordered: true, repeats: false, shuffleTray: false, showMs: 2_500 },
  2: { layers: 4, kinds: 6, ordered: true, repeats: true, shuffleTray: false, showMs: 2_000 },
  3: { layers: 5, kinds: 8, ordered: true, repeats: true, shuffleTray: true, showMs: 2_000 },
};

/** Đáp án dài nhất hợp lệ = tháp cao nhất ở mọi mức. */
const MAX_ANSWER_LENGTH = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].layers));

/**
 * Thời điểm người chơi bắt đầu được chạm (ms, tính từ lúc câu hiện ra) = xem + che.
 * Scene và server dùng chung con số này. Mầm, Thường 2 900 ms; Khó, Siêu khó 2 400 ms.
 */
export function stackRecallRevealMs(puzzle: Pick<StackRecallPuzzle, "showMs" | "coverMs">): number {
  return puzzle.showMs + puzzle.coverMs;
}

/**
 * Các lần chạm `taps` (theo thứ tự chạm) còn đi đúng hướng không, tức còn nối dài được thành đáp án
 * đúng. Có thứ tự: `taps` là tiền tố của `layers`. Mầm: mỗi lần chạm là một loại còn lại của tháp
 * (đếm theo số lần xuất hiện). Scene gọi sau mỗi lần chạm để chấm ngay; `check` dùng lại hàm này.
 */
export function stackRecallOnTrack(
  puzzle: Pick<StackRecallPuzzle, "layers" | "ordered">,
  taps: readonly StackRecallKind[],
): boolean {
  const { layers } = puzzle;
  if (taps.length > layers.length) return false;
  if (puzzle.ordered) {
    for (let i = 0; i < taps.length; i++) if (taps[i] !== layers[i]) return false;
    return true;
  }
  const left = [...layers];
  for (let i = 0; i < taps.length; i++) {
    const at = left.indexOf(taps[i] as StackRecallKind);
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}

/** Mọi cặp vị trí (a < b) không liền nhau trong tháp N tầng: chỗ đặt loại xuất hiện hai lần. */
function nonAdjacentPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 2; b < n; b++) pairs.push([a, b]);
  }
  return pairs;
}

const PAIRS_BY_LENGTH = new Map(
  DIFFICULTIES.map((d) => [LEVELS[d].layers, nonAdjacentPairs(LEVELS[d].layers)]),
);

/**
 * Rút một tháp:
 * - xáo K loại (hoán vị đều);
 * - không lặp (Mầm, Thường; nửa số câu Khó, Siêu khó): lấy N loại đầu;
 * - một loại lặp (nửa số câu Khó, Siêu khó): chọn đều một cặp vị trí không liền nhau; loại đầu
 *   đặt vào cặp đó, N − 2 loại kế lấp các vị trí còn lại từ dưới lên.
 * Trong mỗi nhánh, mọi tháp hợp lệ đều đồng khả năng.
 */
function drawTower(rng: Rng, level: LevelParams): StackRecallKind[] {
  const order = rng.shuffle(Array.from({ length: level.kinds }, (_, k) => k));
  if (!level.repeats || rng.int(0, 1) === 0) return order.slice(0, level.layers);

  const [a, b] = rng.pick(PAIRS_BY_LENGTH.get(level.layers) ?? []);
  const tower = new Array<StackRecallKind>(level.layers);
  tower[a] = order[0] as StackRecallKind;
  tower[b] = order[0] as StackRecallKind;
  let next = 1;
  for (let i = 0; i < level.layers; i++) {
    if (i !== a && i !== b) tower[i] = order[next++] as StackRecallKind;
  }
  return tower;
}

/** Khoá so sánh hai tháp theo luật chấm: có thứ tự thì so cả dãy, Mầm thì so tập hợp. */
function towerKey(layers: readonly StackRecallKind[], ordered: boolean): string {
  return (ordered ? [...layers] : [...layers].sort((x, y) => x - y)).join(",");
}

/** Tháp "tự do" của câu `index`: lần rút đầu tiên từ rng của câu đó. */
function freeTowerKey(roundSeed: number, index: number, level: LevelParams): string {
  return towerKey(drawTower(createRng(deriveSeed(roundSeed, index)), level), level.ordered);
}

export const stackRecall: MinigameDef<StackRecallPuzzle, StackRecallAnswer> = {
  id: "stack-recall",
  category: "memorize",
  // CR-006: vòng 60 s vì mỗi câu có 2,4–2,9 s xem + che không thao tác được.
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả. Hệ số để điểm vòng bằng Thường:
   * Mầm (trẻ 7 tuổi) cần 1,22 → giữ 1 (Mầm = min(mô phỏng, 1)); Khó 1,41; Siêu khó 2,20.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.4, 3: 2.2 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    let layers = drawTower(rng, level);

    // Hai câu liền nhau không bao giờ cùng một tháp (Mầm chỉ có 6 bộ đáp án: không chặn thì cứ
    // ~6 câu lại có một lần lặp liền). Câu chẵn giữ tháp tự do; câu lẻ rút lại tới khi khác tháp tự
    // do của cả câu trước lẫn câu sau (đều là câu chẵn). Không phải sinh lại cả chuỗi câu trước.
    if (index % 2 === 1) {
      const neighbours = [
        freeTowerKey(roundSeed, index - 1, level),
        freeTowerKey(roundSeed, index + 1, level),
      ];
      for (
        let redraws = 0;
        redraws < MAX_REDRAWS && neighbours.includes(towerKey(layers, level.ordered));
        redraws++
      ) {
        layers = drawTower(rng, level);
      }
    }

    const allKinds = Array.from({ length: level.kinds }, (_, k) => k);
    const tray = level.shuffleTray ? rng.shuffle(allKinds) : allKinds;

    return {
      layers,
      tray,
      ordered: level.ordered,
      trayShuffled: level.shuffleTray,
      showMs: level.showMs,
      coverMs: COVER_MS,
    };
  },

  /**
   * Đúng khi và chỉ khi chạm đủ số tầng và mọi lần chạm đều đúng: có thứ tự thì trùng khít
   * `layers`; Mầm thì là một hoán vị của `layers` (cùng các loại, cùng số lần).
   */
  check(puzzle, answer) {
    return answer.length === puzzle.layers.length && stackRecallOnTrack(puzzle, answer);
  },

  /** Mảng 1–5 phần tử, mỗi phần tử là số nguyên 0–7 (giới hạn lấy từ bảng tham số và bộ khối). */
  isAnswer(value): value is StackRecallAnswer {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ANSWER_LENGTH) {
      return false;
    }
    // Duyệt theo chỉ số (không dùng every) để mảng thưa cũng bị từ chối.
    for (let i = 0; i < value.length; i++) {
      const kind: unknown = value[i];
      if (
        typeof kind !== "number" ||
        !Number.isInteger(kind) ||
        kind < 0 ||
        kind >= STACK_RECALL_KINDS.length
      ) {
        return false;
      }
    }
    return true;
  },

  /**
   * CR-006: miễn trừ thưởng tốc độ = xem + che (lúc chưa được chạm) + 300 ms cho mỗi lần chạm sau
   * lần đầu. Mầm 3 200 ms, Thường 3 500, Khó 3 300, Siêu khó 3 600. Lịch đã nằm trong câu đố nên
   * không cần `difficulty`.
   */
  speedAllowanceMs(puzzle) {
    return stackRecallRevealMs(puzzle) + TAP_ALLOWANCE_MS * Math.max(0, puzzle.layers.length - 1);
  },
};
