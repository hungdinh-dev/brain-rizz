import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  IconBadge,
  Mark,
  popIn,
  RectRing,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { Box, Card, Piece, PieceFitHowTo } from "./PieceFitHowTo";

type Point = readonly [x: number, y: number];

/** Hình minh hoạ dời sang phải 46 để hộp nằm giữa sân khấu. */
const DX = 46;
/** Tâm khoảng trống chữ L ở góc phải dưới hộp 5 × 5. */
const GAP_AT: Point = [316 + DX, 98];
/** Tâm hai thẻ 130 × 130: trái chữ L xoay 90° (đúng), phải bản lật gương (sai). */
const GOOD: Point = [175 + DX, 261];
const BAD: Point = [385 + DX, 261];
/** Viền khoảng trống (lùi vào 2,5 như hình minh hoạ) so với tâm khoảng trống. */
const GAP_OUTLINE = "M-21.5 -33.5 H-2.5 V14.5 H21.5 V33.5 H-21.5 Z";
/** Ô của hai mảnh, góc trên trái từng ô so với tâm mảnh (ô 24). */
const TURNED = [
  [-36, -24],
  [-12, -24],
  [12, -24],
  [-36, 0],
] as const;
const MIRRORED = [
  [-36, -24],
  [-36, 0],
  [-12, 0],
  [12, 0],
] as const;

/**
 * Kịch bản Mảnh vừa khít (CR-021, T = 4.800 ms): nhìn khoảng trống chữ L → chạm mảnh chữ L nằm
 * xoay → ✓, mảnh bay vào và quay ngược 90° là khít; mảnh lật gương bị gạch ✗ + icon gương.
 */
export const PIECE_FIT_SCRIPT = defineScript({
  id: "pcf",
  T: 4800,
  steps: [0, 1000, 2500],
  hand: {
    moves: [
      [650, 500, GOOD],
      [1450, 400, null],
    ],
    taps: [1250],
  },
  tracks: {
    gap: track({ o: 0 }).fade(300, 150).bump(450, 1.12, 300).fade(1000, 150, 0),
    good: track().bump(1310, 1.06, 180),
    ring: popIn(1310),
    ok: popIn(1370),
    rp: ripple(1250),
    // Bản sao của mảnh đúng bay từ thẻ vào khoảng trống, quay ngược 90°.
    fly: track({ o: 0 })
      .fade(1500, 80, 0.9, "linear")
      .to(1580, 520, { x: GAP_AT[0] - GOOD[0], y: GAP_AT[1] - GOOD[1], r: -90, o: 1 }, "glide")
      .bump(2100, 1.08, 160),
    turn: popIn(1580),
    bad: track({ o: 0 }).fade(2600, 120),
    x: popIn(2660),
    mir: popIn(2740),
  },
});

/** Hình minh hoạ động Mảnh vừa khít (màn Hướng dẫn); khung tĩnh = `PieceFitHowTo`. */
export function PieceFitDemo(props: DemoProps) {
  return (
    <DemoStage
      script={PIECE_FIT_SCRIPT}
      still={PieceFitHowTo}
      {...props}
      backdrop={
        <g transform={`translate(${DX} 0)`}>
          <Box />
          <Card x={320} y={196} />
        </g>
      }
    >
      {/* Bước ①: viền vàng nhịp quanh khoảng trống */}
      <A k="gap" x={GAP_AT[0]} y={GAP_AT[1]}>
        <path
          d={GAP_OUTLINE}
          fill="none"
          className="stroke-primary"
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </A>

      <A k="good" x={GOOD[0]} y={GOOD[1]}>
        <Card x={-65} y={-65} />
        <Piece cells={TURNED} />
      </A>
      <g transform={`translate(${BAD[0]} ${BAD[1]})`}>
        <Piece cells={MIRRORED} />
      </g>

      <RectRing k="ring" x={GOOD[0]} y={GOOD[1]} w={148} h={148} rx={22} />
      <Mark k="ok" x={GOOD[0] - 68} y={GOOD[1] - 70} kind="ok" />
      <Ripple k="rp" x={GOOD[0]} y={GOOD[1]} />
      <IconBadge k="turn" x={281 + DX} y={196} r={20}>
        <g transform="scale(0.8) scale(-1 1)" strokeWidth={3}>
          <path d="M-12 -6 A13 13 0 1 1 -6 12" />
          <path d="M-0.3 9.3 L-9.6 10.2 L-4.7 18.3" />
        </g>
      </IconBadge>
      <A k="fly" x={GOOD[0]} y={GOOD[1]}>
        <Piece cells={TURNED} />
      </A>

      {/* Bản lật gương: viền đỏ gạch đứt, ✗, icon gương */}
      <A k="bad" x={BAD[0]} y={BAD[1]}>
        <rect
          x={-72}
          y={-72}
          width={144}
          height={144}
          rx={20}
          fill="none"
          className="stroke-destructive"
          strokeWidth={4.5}
          strokeDasharray="11 7"
        />
      </A>
      <Mark k="x" x={BAD[0] + 68} y={BAD[1] - 70} kind="bad" />
      <IconBadge k="mir" x={BAD[0] + 104} y={BAD[1]} r={20}>
        <path d="M0 -12 L0 12" strokeWidth={2.4} strokeDasharray="3.5 3" />
        <path d="M-4 0 L-13 0 M-9 -4 L-13 0 L-9 4 M4 0 L13 0 M9 -4 L13 0 L9 4" strokeWidth={2.6} />
      </IconBadge>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
