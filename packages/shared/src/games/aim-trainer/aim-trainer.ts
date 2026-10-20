import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Luyện ngắm (nhóm Nhận diện): một tấm bia tròn hiện ở chỗ bất kỳ trong khung, chạm trúng càng
 * nhanh càng tốt; trúng là bia mới hiện ngay ở chỗ khác. Một câu = một tấm bia, đáp án là toạ độ
 * chạm. Ở mức cao bia biến mất nếu chạm chậm (server kiểm hạn qua `answerWindowMs`), Siêu khó có
 * thêm bia mồi đỏ không được bắn.
 * Đặc tả: docs/04-minigames/aim-trainer.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now().
 */

/** Khung chơi theo đơn vị logic: gốc ở góc trên trái, y hướng xuống, tỉ lệ 5 : 7. */
export const AIM_FIELD = { width: 1000, height: 1400 } as const;

export interface AimPoint {
  x: number;
  y: number;
}

export interface AimTrainerPuzzle {
  /** Tâm bia thật (đơn vị khung, số nguyên). */
  x: number;
  y: number;
  /** Bán kính vẽ lúc bia hiện. */
  r: number;
  /** Bán kính chấm = `r` + dung sai chạm. Giữ nguyên suốt đời bia, kể cả khi bia co. */
  hitR: number;
  /** Thời gian bia tồn tại (ms) kể từ lúc hiện; 0 = không giới hạn (Mầm). */
  lifeMs: number;
  /** Bán kính vẽ lúc biến mất, % của `r` (100 = không co). Chỉ để vẽ, không ảnh hưởng chấm. */
  shrinkTo: number;
  /** Tâm bia mồi đỏ: cùng `r`, `hitR`, `lifeMs`, cùng co. Rỗng trừ Siêu khó. */
  decoys: AimPoint[];
}

/**
 * Đáp án = toạ độ chạm (số nguyên, trong khung), hoặc `AIM_TRAINER_MISS` khi hết `lifeMs` mà
 * chưa trúng. Chạm vào chỗ trống thì client không gửi.
 */
export type AimTrainerAnswer = AimPoint;

/** Đáp án "bỏ lỡ": client gửi khi bia hết giờ. Luôn chấm sai. */
export const AIM_TRAINER_MISS: Readonly<AimPoint> = { x: -1, y: -1 };

/** Dung sai chạm cộng vào bán kính vẽ, giống nhau cho chuột và ngón tay. */
const HIT_TOLERANCE = 25;
/** Tâm bia cách mép khung ≥ hitR + ngần này, để cả vùng chấm nằm trong khung. */
const EDGE_GAP = 15;
/** Số câu mỗi khối sinh vị trí (đặc tả, mục Cách sinh câu đố). */
const BLOCK = 8;
/** Số lần rút ngẫu nhiên trước khi dùng lưới dự phòng. */
const MAX_TRIES = 40;
/** Lưới dự phòng 5 × 7 điểm của vùng cho phép. */
const GRID_COLS = 5;
const GRID_ROWS = 7;
/** Mồi cách tâm bia thật và cách nhau ≥ ngần này (> 2 × hitR nên vùng chấm không giao nhau). */
const DECOY_GAP = 220;
/** Mồi cách bia của câu trước ≥ ngần này, để cú chạm dư ở chỗ cũ không trúng mồi. */
const DECOY_PREV_GAP = 300;

const SALT_POS = 1;
const SALT_DECOY = 2;

interface Level {
  r: number;
  lifeMs: number;
  shrinkTo: number;
  /** Khoảng cách tối thiểu từ bia trước. */
  minJump: number;
  /** Số mồi nhỏ nhất / lớn nhất (rút đều). */
  decoys: readonly [number, number];
}

const LEVELS: Readonly<Record<Difficulty, Level>> = {
  0: { r: 110, lifeMs: 0, shrinkTo: 100, minJump: 250, decoys: [0, 0] },
  1: { r: 80, lifeMs: 1_500, shrinkTo: 100, minJump: 300, decoys: [0, 0] },
  2: { r: 65, lifeMs: 1_300, shrinkTo: 40, minJump: 500, decoys: [0, 0] },
  3: { r: 55, lifeMs: 1_500, shrinkTo: 40, minJump: 500, decoys: [1, 2] },
};

/** Điểm cần tránh và khoảng cách tối thiểu tới nó. */
interface Avoid {
  p: AimPoint;
  min: number;
}

const dist2 = (a: AimPoint, b: AimPoint): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Vùng cho phép đặt tâm bia: [lo, hiX] × [lo, hiY]. */
function bounds(level: Level): { lo: number; hiX: number; hiY: number } {
  const lo = level.r + HIT_TOLERANCE + EDGE_GAP;
  return { lo, hiX: AIM_FIELD.width - lo, hiY: AIM_FIELD.height - lo };
}

function drawFree(rng: Rng, level: Level): AimPoint {
  const { lo, hiX, hiY } = bounds(level);
  return { x: rng.int(lo, hiX), y: rng.int(lo, hiY) };
}

/**
 * Rút một tâm đều trong vùng cho phép, cách mọi điểm trong `avoid` ít nhất `min` của điểm đó.
 * Hết `MAX_TRIES` lần thì lấy điểm lưới 5 × 7 có "khoảng dư" nhỏ nhất lớn nhất (tất định).
 * Lưới luôn có điểm thoả ràng buộc với ≤ 3 điểm cần tránh ở mọi mức (kiểm bằng test 10 000 seed).
 */
function drawAvoiding(rng: Rng, level: Level, avoid: readonly Avoid[]): AimPoint {
  const ok = (p: AimPoint) => avoid.every((a) => dist2(p, a.p) >= a.min * a.min);
  for (let t = 0; t < MAX_TRIES; t++) {
    const p = drawFree(rng, level);
    if (ok(p)) return p;
  }
  const { lo, hiX, hiY } = bounds(level);
  let best: AimPoint = { x: lo, y: lo };
  let bestSlack = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const p = {
        x: lo + Math.round((col * (hiX - lo)) / (GRID_COLS - 1)),
        y: lo + Math.round((row * (hiY - lo)) / (GRID_ROWS - 1)),
      };
      const slack = Math.min(...avoid.map((a) => Math.sqrt(dist2(p, a.p)) - a.min));
      if (slack > bestSlack) {
        bestSlack = slack;
        best = p;
      }
    }
  }
  return best;
}

const blockRng = (seed: number, block: number) => createRng(deriveSeed(seed, block, SALT_POS));

/** Bia cuối khối (`k = 7`): luôn là lần rút đầu tiên của rng khối, nên tính rẻ. */
function lastOfBlock(seed: number, block: number, level: Level): AimPoint {
  return drawFree(blockRng(seed, block), level);
}

/**
 * Tâm bia câu `index` và tâm bia câu trước (null nếu là câu 0). Chi phí không phụ thuộc `index`:
 * một khối 8 lần rút cộng một lần rút đầu của khối trước.
 */
function targetAt(
  seed: number,
  index: number,
  level: Level,
): { cur: AimPoint; prev: AimPoint | null } {
  const block = Math.floor(index / BLOCK);
  const k = index % BLOCK;
  const rng = blockRng(seed, block);
  const last = drawFree(rng, level);
  // Câu 0 của vòng không có bia trước; k = 0 của khối sau so với bia cuối khối trước.
  let prev = block > 0 ? lastOfBlock(seed, block - 1, level) : null;
  // Rút k = 0 … 6 theo thứ tự (k = 7 vẫn phải rút đủ để biết bia k = 6 làm bia trước).
  for (let j = 0; j < BLOCK - 1; j++) {
    const avoid: Avoid[] = [];
    if (prev) avoid.push({ p: prev, min: level.minJump });
    if (j === BLOCK - 2) avoid.push({ p: last, min: level.minJump });
    const p = drawAvoiding(rng, level, avoid);
    if (j === k) return { cur: p, prev };
    prev = p;
  }
  return { cur: last, prev };
}

/** Kết quả một cú chạm: trúng bia thật, trúng bia mồi, hoặc hụt (chỗ trống, client không gửi). */
export type AimHit = "target" | "decoy" | "none";

/**
 * Phân loại cú chạm tại `(x, y)` (đơn vị khung). Scene dùng hàm này để quyết định có gửi không,
 * không tự viết lại công thức. Vùng chấm bia và mồi không giao nhau nên kết quả là duy nhất.
 */
export function aimTrainerHitTest(puzzle: AimTrainerPuzzle, x: number, y: number): AimHit {
  const p = { x, y };
  const r2 = puzzle.hitR * puzzle.hitR;
  if (dist2(p, puzzle) <= r2) return "target";
  if (puzzle.decoys.some((d) => dist2(p, d) <= r2)) return "decoy";
  return "none";
}

const isMiss = (a: AimPoint) => a.x === AIM_TRAINER_MISS.x && a.y === AIM_TRAINER_MISS.y;

export const aimTrainer: MinigameDef<AimTrainerPuzzle, AimTrainerAnswer> = {
  id: "aim-trainer",
  category: "identify",
  durationMs: 60_000,

  // Đặc tả, mục Cân bằng: mô phỏng 200 000 vòng mỗi mức. Mầm theo trần chung = 1.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.75, 3: 2.55 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const { cur, prev } = targetAt(roundSeed, index, level);

    const decoys: AimPoint[] = [];
    const [minDecoys, maxDecoys] = level.decoys;
    if (maxDecoys > 0) {
      const rng = createRng(deriveSeed(roundSeed, index, SALT_DECOY));
      const count = rng.int(minDecoys, maxDecoys);
      for (let n = 0; n < count; n++) {
        const avoid: Avoid[] = [{ p: cur, min: DECOY_GAP }];
        if (prev) avoid.push({ p: prev, min: DECOY_PREV_GAP });
        for (const d of decoys) avoid.push({ p: d, min: DECOY_GAP });
        decoys.push(drawAvoiding(rng, level, avoid));
      }
    }

    return {
      x: cur.x,
      y: cur.y,
      r: level.r,
      hitR: level.r + HIT_TOLERANCE,
      lifeMs: level.lifeMs,
      shrinkTo: level.shrinkTo,
      decoys,
    };
  },

  check(puzzle, answer) {
    if (isMiss(answer)) return false;
    return dist2(answer, puzzle) <= puzzle.hitR * puzzle.hitR;
  },

  isAnswer(value): value is AimTrainerAnswer {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if (keys.length !== 2 || !keys.includes("x") || !keys.includes("y")) return false;
    const { x, y } = value as Record<string, unknown>;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const ix = x as number;
    const iy = y as number;
    if (ix === AIM_TRAINER_MISS.x && iy === AIM_TRAINER_MISS.y) return true;
    return ix >= 0 && ix <= AIM_FIELD.width && iy >= 0 && iy <= AIM_FIELD.height;
  },

  // Bia biến mất sau `lifeMs`: server chấm sai câu trả lời tới muộn (cộng dung sai mạng).
  answerWindowMs(puzzle) {
    return puzzle.lifeMs > 0 ? puzzle.lifeMs : undefined;
  },
};
