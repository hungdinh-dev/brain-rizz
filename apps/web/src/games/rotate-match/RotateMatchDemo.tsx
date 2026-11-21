import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  IconBadge,
  LockPill,
  Mark,
  popIn,
  Question,
  questionIn,
  questionOut,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { RotateMatchHowTo } from "./RotateMatchHowTo";

type Cell = readonly [x: number, y: number];

/** Cạnh một ô của hình (đơn vị sân khấu). */
const CELL = 22;
/** Chữ L (`#.` / `#.` / `##`) quanh tâm 0,0: góc trên trái từng ô. */
const L_CELLS: readonly Cell[] = [
  [-16.5, -38.5],
  [-16.5, -16.5],
  [-16.5, 5.5],
  [5.5, 5.5],
];
/** Bản lật gương (chữ J). */
const J_CELLS: readonly Cell[] = [
  [-5.5, -38.5],
  [-5.5, -16.5],
  [-5.5, 5.5],
  [-27.5, 5.5],
];
/** Thẻ lựa chọn 128 tâm (232, 254) và (408, 254); ✓/✗ ở góc trên phải thẻ trái. */
const LEFT = [232, 254] as const;
const RIGHT = [408, 254] as const;
const MARK = [290, 196] as const;

/**
 * Kịch bản Xoay hình (UI-UX 6.11, T = 5.500 ms): nhìn thẻ mẫu → chạm thẻ xoay đúng, bóng ma xoay
 * khớp → ✓; câu 2 chạm bản lật → rung + ✗ + icon gương + khoá, thẻ đúng hiện ✓ và bóng ma −90°.
 */
export const ROTATE_MATCH_SCRIPT = defineScript({
  id: "rm",
  T: 5500,
  steps: [0, 1000, 2700],
  hand: {
    moves: [
      [1000, 500, [LEFT[0], LEFT[1] + 2]],
      [3500, 400, null],
    ],
    taps: [1600, 3100],
  },
  tracks: {
    model: track().to(400, 200, { s: 1.06 }, "glide").to(600, 200, { s: 1 }, "glide"),
    rot: popIn(700),
    q1: questionOut(2500),
    q2: questionIn(2700),
    lp: track().to(1600, 80, { s: 0.97 }).to(1680, 160, { s: 1 }),
    g1: track({ o: 0 })
      .fade(1660, 80, 0.6, "linear")
      .to(1760, 240, { r: 90 }, "glide")
      .fade(2000, 80, 0),
    f1: track().bump(2000, 1.08, 120),
    ob1: track({ o: 0 }).fade(2000, 80),
    ok1: popIn(2050),
    rp1: ripple(1600),
    sh: track().shake(3160),
    bad: track({ o: 0 }).fade(3160, 80),
    x2: popIn(3160),
    lk: popIn(3200),
    mir: popIn(3220),
    lkb: track().to(3300, 1200, { sx: 0 }, "linear"),
    ob2: track({ o: 0 }).fade(3300, 80),
    ok2: popIn(3300),
    g2: track({ o: 0 })
      .fade(3300, 80, 0.6, "linear")
      .to(3400, 300, { r: -90 }, "glide")
      .fade(3700, 80, 0),
    f2: track().bump(3700, 1.08, 120),
    rp2: ripple(3100),
  },
});

/** Hình ghép ô: viền mực ngoài, ô tím nhóm Hình dung, đường chia ô mờ; xoay `angle` độ quanh tâm. */
function Figure({ cells, angle = 0 }: { cells: readonly Cell[]; angle?: number }) {
  const rects = cells.map(([x, y]) => (
    <rect key={`${x},${y}`} x={x} y={y} width={CELL} height={CELL} />
  ));
  return (
    <g transform={angle ? `rotate(${angle})` : undefined}>
      <g fill="none" className="stroke-ink" strokeWidth={5}>
        {rects}
      </g>
      <g className="fill-visualize">{rects}</g>
      <g fill="none" className="stroke-ink" strokeOpacity={0.4} strokeWidth={1.2}>
        {rects}
      </g>
    </g>
  );
}

/** Bóng ma: viền nét đứt của hình mẫu (làn xoay nó từ 0° tới góc của thẻ). */
function Ghost() {
  return (
    <g fill="none" className="stroke-ink" strokeWidth={3} strokeDasharray="5 4">
      {L_CELLS.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={CELL} height={CELL} />
      ))}
    </g>
  );
}

/** Thẻ giấy viền mực có bóng đổ, cạnh `size`, tâm 0,0. */
function Card({ size, border }: { size: number; border: number }) {
  const h = size / 2;
  return (
    <>
      <rect x={-h} y={-h + 4} width={size} height={size} rx={16} className="fill-ink" />
      <rect
        x={-h}
        y={-h}
        width={size}
        height={size}
        rx={16}
        className="fill-paper stroke-ink"
        strokeWidth={border}
      />
    </>
  );
}

/** Viền quanh thẻ lựa chọn: xanh (đúng) hoặc gạch đứt đỏ (sai). */
function Outline({ bad }: { bad?: boolean }) {
  return (
    <rect
      x={-68}
      y={-68}
      width={136}
      height={136}
      rx={20}
      fill="none"
      className={bad ? "stroke-destructive" : "stroke-compute"}
      strokeWidth={bad ? 4.5 : 5}
      strokeDasharray={bad ? "11 7" : undefined}
    />
  );
}

/** Hình minh hoạ động Xoay hình (màn Hướng dẫn); khung tĩnh = `RotateMatchHowTo`. */
export function RotateMatchDemo(props: DemoProps) {
  return (
    <DemoStage script={ROTATE_MATCH_SCRIPT} still={RotateMatchHowTo} {...props}>
      {/* Thẻ mẫu chữ L + icon con mắt; icon ↻ cạnh thẻ */}
      <A k="model" x={320} y={68}>
        <Card size={108} border={4} />
        <path
          d="M-43 -38 C-40 -43 -36 -45 -32 -45 C-28 -45 -24 -43 -21 -38 C-24 -33 -28 -31 -32 -31 C-36 -31 -40 -33 -43 -38 Z"
          className="fill-paper stroke-ink"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle cx={-32} cy={-38} r={3.5} className="fill-visualize stroke-ink" strokeWidth={1.5} />
        <Figure cells={L_CELLS} />
      </A>
      <A k="rot" x={410} y={64}>
        <g
          fill="none"
          className="stroke-chalk"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M-12 -6 A13 13 0 1 1 -6 12" />
          <path d="M-0.3 9.3 L-9.6 10.2 L-4.7 18.3" />
        </g>
      </A>

      {/* Câu 1: trái L xoay 90° (đúng), phải J xoay 90° */}
      <Question k="q1">
        <A k="lp" x={LEFT[0]} y={LEFT[1]}>
          <Card size={128} border={3} />
          <A k="f1">
            <Figure cells={L_CELLS} angle={90} />
          </A>
          <A k="g1">
            <Ghost />
          </A>
        </A>
        <A k="ob1" x={LEFT[0]} y={LEFT[1]}>
          <Outline />
        </A>
        <g transform={`translate(${RIGHT[0]} ${RIGHT[1]})`}>
          <Card size={128} border={3} />
          <Figure cells={J_CELLS} angle={90} />
        </g>
        <Mark k="ok1" x={MARK[0]} y={MARK[1]} kind="ok" />
        <Ripple k="rp1" x={LEFT[0]} y={LEFT[1]} />
      </Question>

      {/* Câu 2: trái J xoay 180° (bản lật, sai), phải L xoay 270° (đúng) */}
      <Question k="q2">
        <A k="sh" x={LEFT[0]} y={LEFT[1]}>
          <Card size={128} border={3} />
          <Figure cells={J_CELLS} angle={180} />
          <A k="bad">
            <Outline bad />
          </A>
        </A>
        <g transform={`translate(${RIGHT[0]} ${RIGHT[1]})`}>
          <Card size={128} border={3} />
          <A k="f2">
            <Figure cells={L_CELLS} angle={270} />
          </A>
          <A k="g2">
            <Ghost />
          </A>
        </g>
        <A k="ob2" x={RIGHT[0]} y={RIGHT[1]}>
          <Outline />
        </A>
        <Mark k="x2" x={MARK[0]} y={MARK[1]} kind="bad" />
        <IconBadge k="mir" x={174} y={196} r={18}>
          <path d="M0 -11 L0 11" strokeWidth={2.4} strokeDasharray="3.5 3" />
          <path
            d="M-4 0 L-13 0 M-9 -4 L-13 0 L-9 4 M4 0 L13 0 M9 -4 L13 0 L9 4"
            strokeWidth={2.6}
          />
        </IconBadge>
        <Mark k="ok2" x={RIGHT[0] + 58} y={RIGHT[1] - 58} kind="ok" />
        <LockPill k="lk" kb="lkb" x={206} y={64} />
        <Ripple k="rp2" x={LEFT[0]} y={LEFT[1]} />
      </Question>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
