import {
  type HeadCountEvent,
  type HeadCountPuzzle,
  headCountEventStartMs,
  headCountInputAtMs,
} from "@brain-rizz/shared";

/*
 * Dòng thời gian trình chiếu của Đếm sĩ số (đặc tả docs/04-minigames/head-count.md, mục "Scene
 * chạy theo dòng thời gian của Puzzle"). Hàm thuần: scene gọi mỗi khung hình với
 * `t = now − t0` và vẽ đúng trạng thái suy ra từ `t`, không cộng dồn theo khung hình, nên máy
 * chậm hay rớt khung thì nhảy tới đúng chỗ chứ không trễ dần.
 */

/** Tường hạ trong 250 ms cuối của pha xem lớp. */
export const WALL_DROP_MS = 250;
/** Người đi chuyển động trong 70 % đầu của lượt; 30 % còn lại để trống cho hai lượt không dính. */
export const WALK_SHARE = 0.7;

export type Stage =
  /** Xem lớp; `wall` = tiến độ tường hạ (0 = lớp mở, 1 = che kín). */
  | { kind: "show"; wall: number }
  /** Lượt `k`; `walk` = tiến độ đi trong lượt (1 = đã đi xong, đang nghỉ). */
  | { kind: "step"; k: number; walk: number }
  /** Cửa đã đóng, được chạm; `sinceMs` tính từ `headCountInputAtMs`. */
  | { kind: "input"; sinceMs: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function stageAt(
  puzzle: Pick<HeadCountPuzzle, "showMs" | "stepMs" | "events">,
  t: number,
): Stage {
  if (t < puzzle.showMs) {
    return { kind: "show", wall: clamp01((t - (puzzle.showMs - WALL_DROP_MS)) / WALL_DROP_MS) };
  }
  const inputAt = headCountInputAtMs(puzzle);
  if (t >= inputAt) return { kind: "input", sinceMs: t - inputAt };
  const k = Math.min(puzzle.events.length - 1, Math.floor((t - puzzle.showMs) / puzzle.stepMs));
  const local = t - headCountEventStartMs(puzzle, k);
  return { kind: "step", k, walk: clamp01(local / (puzzle.stepMs * WALK_SHARE)) };
}

// ---------------------------------------------------------------- người đi trong một lượt

export interface Walker {
  dir: "in" | "out";
  teacher: boolean;
  /** Thứ tự trong nhóm cùng hướng (0 = đi đầu); thầy luôn đi cuối nhóm. */
  slot: number;
  /** Số người cùng hướng trong lượt. */
  group: number;
}

/** Mọi người qua cửa ở một lượt: nhóm vào rồi nhóm ra (hai nhóm đi cùng lúc, hai phía cửa). */
export function walkersOf(event: HeadCountEvent): Walker[] {
  const list: Walker[] = [];
  for (const dir of ["in", "out"] as const) {
    const kids = dir === "in" ? event.in : event.out;
    const teacher = event.teacher === dir;
    const group = kids + (teacher ? 1 : 0);
    for (let slot = 0; slot < kids; slot++) list.push({ dir, teacher: false, slot, group });
    if (teacher) list.push({ dir, teacher: true, slot: kids, group });
  }
  return list;
}

/** Thầy có đứng trong lớp lúc cửa đóng không (thầy không tính vào sĩ số). */
export function teacherInsideAtEnd(puzzle: Pick<HeadCountPuzzle, "teacherAtStart" | "events">) {
  let inside = puzzle.teacherAtStart;
  for (const e of puzzle.events) if (e.teacher) inside = e.teacher === "in";
  return inside;
}

// ---------------------------------------------------------------- đường đi (khung 720×1280)

/** Chân người đi ở hành lang; người đi sau trong nhóm lùi vào trong `LANE_BACK` px. */
export const LANE_Y = 900;
export const LANE_BACK = 24;
/** Chân người ở ngưỡng cửa (đáy cửa y 760). */
export const DOOR_FEET_Y = 758;
/** Người đi sau cách người đi trước ~46 px dọc đường (so le, không che nhau quá 1/3). */
export const GAP = 46;

interface PathPoint {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

/**
 * Bạn VÀO: hiện dần ở mép trái (x 72 → 110), đi tới trước cửa, bước lên ngưỡng rồi khuất vào
 * trong. Bạn RA: hiện ra từ cửa, bước xuống hành lang, đi sang phải tới x 610 rồi mờ đi.
 * Đoạn có cửa (`door`) là đoạn mà người đi sau nhập vào giữa cửa (bỏ lệch hàng).
 */
const PATHS: Record<Walker["dir"], { points: PathPoint[]; door: number }> = {
  in: {
    points: [
      { x: 72, y: LANE_Y, alpha: 0, scale: 1 },
      { x: 110, y: LANE_Y, alpha: 1, scale: 1 },
      { x: 338, y: LANE_Y, alpha: 1, scale: 1 },
      { x: 354, y: DOOR_FEET_Y, alpha: 0, scale: 0.86 },
    ],
    door: 2,
  },
  out: {
    points: [
      { x: 366, y: DOOR_FEET_Y, alpha: 0, scale: 0.86 },
      { x: 382, y: LANE_Y, alpha: 1, scale: 1 },
      { x: 610, y: LANE_Y, alpha: 1, scale: 1 },
      { x: 648, y: LANE_Y, alpha: 0, scale: 1 },
    ],
    door: 0,
  },
};

const lengths = (points: PathPoint[]) =>
  points.slice(1).map((p, i) => {
    const q = points[i] as PathPoint;
    return Math.hypot(p.x - q.x, p.y - q.y);
  });

const PATH_LENGTHS = { in: lengths(PATHS.in.points), out: lengths(PATHS.out.points) };
const total = (dir: Walker["dir"]) => PATH_LENGTHS[dir].reduce((a, b) => a + b, 0);

export interface Pose {
  x: number;
  /** Chân. */
  y: number;
  alpha: number;
  scale: number;
  /** Quãng đã đi (px), để tính nhịp bước. */
  dist: number;
}

/**
 * Vị trí của `walker` khi nhóm của nó đi được `walk` (0…1) quãng của lượt. Cả nhóm đi cùng tốc
 * độ, cách nhau `GAP`; người cuối nhóm tới cuối đường đúng lúc `walk` = 1. `null` = chưa xuất
 * hiện hoặc đã khuất.
 */
export function poseAt(walker: Walker, walk: number): Pose | null {
  const { points, door } = PATHS[walker.dir];
  const segs = PATH_LENGTHS[walker.dir];
  const length = total(walker.dir);
  const dist = walk * (length + GAP * (walker.group - 1)) - GAP * walker.slot;
  if (dist <= 0 || dist >= length) return null;

  let left = dist;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i] as number;
    if (left > seg && i < segs.length - 1) {
      left -= seg;
      continue;
    }
    const a = points[i] as PathPoint;
    const b = points[i + 1] as PathPoint;
    const f = Math.min(1, left / seg);
    // Người đi sau lùi vào trong hàng; tới cửa thì nhập vào giữa cửa.
    const back = walker.slot % 2 === 1 ? LANE_BACK : 0;
    const lane = i === door ? (walker.dir === "in" ? 1 - f : f) : 1;
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f - back * lane,
      alpha: a.alpha + (b.alpha - a.alpha) * f,
      scale: a.scale + (b.scale - a.scale) * f,
      dist,
    };
  }
  return null;
}
