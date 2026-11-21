import { NAVON_GRID, NAVON_MASKS } from "@brain-rizz/shared";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
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
import { NavonShapesHowTo, squareLinks } from "./NavonShapesHowTo";

type Point = readonly [x: number, y: number];
type ButtonShape = "triangle" | "circle" | "square";

/** Tâm khung; lưới hình to 7 × 7 ô 17, hình nhỏ là đĩa r 6 (như hình minh hoạ). */
const FRAME: Point = [320, 132];
const CELL = 17;
const DOT = 6;
/** Khung tròn r 96; khung vuông 192 viền chuỗi 15 ô vuông 9 × 9 mỗi cạnh. */
const RING_R = 96;
const SQUARE = 192;
const LINKS = squareLinks(SQUARE, 9, 15);
/** Ba nút hình dưới khung (64 × 54). */
const BUTTON_Y = 296;
const BUTTONS: readonly (readonly [ButtonShape, number])[] = [
  ["triangle", 236],
  ["circle", 320],
  ["square", 404],
];
/** Câu 1 khung tròn → hình to (tam giác); câu 2 khung vuông → hình nhỏ (tròn). */
const PICK_1: Point = [236, BUTTON_Y];
const PICK_2: Point = [320, BUTTON_Y];

const TRIANGLE_ICON = "M0 -14 L16 14 L-16 14 Z";

/**
 * Kịch bản Hình to hình nhỏ (CR-021, T = 5.200 ms): tam giác to ghép từ hình tròn nhỏ; câu 1 khung
 * tròn → chạm nút tam giác (hình to) → ✓; câu 2 cùng hình nhưng khung vuông → chạm nút tròn (hình
 * nhỏ) → ✓.
 */
export const NAVON_SHAPES_SCRIPT = defineScript({
  id: "nvs",
  T: 5200,
  steps: [0, 1000, 2700],
  hand: {
    moves: [
      [650, 500, PICK_1],
      [2550, 400, PICK_2],
      [3700, 400, null],
    ],
    taps: [1300, 3250],
  },
  tracks: {
    f1: track().to(350, 200, { s: 1.05 }, "glide").to(550, 200, { s: 1 }, "glide"),
    q1: questionOut(2500),
    q2: questionIn(2700),
    f2: track().to(2950, 200, { s: 1.05 }, "glide").to(3150, 200, { s: 1 }, "glide"),
    sel1: popIn(1360, 200, 0.8),
    ok1: popIn(1420),
    rp1: ripple(1300),
    sel2: popIn(3310, 200, 0.8),
    ok2: popIn(3370),
    rp2: ripple(3250),
  },
});

/** Tam giác to ghép từ các đĩa phấn nhỏ, tâm 0,0. */
function NavonTriangle() {
  const mid = (NAVON_GRID - 1) / 2;
  return (
    <g className="fill-chalk">
      {NAVON_MASKS.triangle.map((cell) => (
        <circle
          key={`${cell.col}-${cell.row}`}
          cx={(cell.col - mid) * CELL}
          cy={(cell.row - mid) * CELL}
          r={DOT}
        />
      ))}
    </g>
  );
}

/** Khung tròn: tấm bảng tô đậm, viền một nét phấn liền. */
function RoundFrame() {
  return (
    <>
      <circle r={RING_R} className="fill-board-shade" />
      <circle r={RING_R} fill="none" strokeWidth={5} className="stroke-chalk" />
    </>
  );
}

/** Khung vuông: tấm bảng tô đậm góc vuông, viền là chuỗi ô vuông phấn nhỏ rỗng. */
function SquareFrame() {
  const half = SQUARE / 2;
  return (
    <>
      <rect x={-half} y={-half} width={SQUARE} height={SQUARE} className="fill-board-shade" />
      <g fill="none" strokeWidth={2.5} className="stroke-chalk">
        {LINKS.map(([lx, ly]) => (
          <rect key={`${lx}-${ly}`} x={lx + 1.25} y={ly + 1.25} width={6.5} height={6.5} />
        ))}
      </g>
    </>
  );
}

/** Hình trên nút: tam giác, đĩa hoặc vuông đặc. */
function Glyph({ shape, className }: { shape: ButtonShape; className: string }) {
  if (shape === "triangle") return <path d={TRIANGLE_ICON} className={className} />;
  if (shape === "circle") return <circle r={14} className={className} />;
  return <rect x={-13} y={-13} width={26} height={26} rx={2} className={className} />;
}

/** Nút hình chưa chọn: viền phấn, hình phấn. */
function IdleButton({ shape }: { shape: ButtonShape }) {
  return (
    <>
      <rect
        x={-32}
        y={-27}
        width={64}
        height={54}
        rx={14}
        fill="none"
        strokeWidth={3.5}
        className="stroke-chalk"
      />
      <g transform="translate(0 -1)">
        <Glyph shape={shape} className="fill-chalk" />
      </g>
    </>
  );
}

/** Nút hình đã chọn: nền vàng viền mực, hình mực, bóng đổ. */
function PickedButton({ shape }: { shape: ButtonShape }) {
  return (
    <>
      <rect x={-32} y={-23} width={64} height={54} rx={14} className="fill-ink" />
      <rect
        x={-32}
        y={-27}
        width={64}
        height={54}
        rx={14}
        strokeWidth={3.5}
        className="fill-primary stroke-ink"
      />
      <g transform="translate(0 -1)">
        <Glyph shape={shape} className="fill-ink" />
      </g>
    </>
  );
}

/** Hình minh hoạ động Hình to hình nhỏ (màn Hướng dẫn); khung tĩnh = `NavonShapesHowTo`. */
export function NavonShapesDemo(props: DemoProps) {
  return (
    <DemoStage script={NAVON_SHAPES_SCRIPT} still={NavonShapesHowTo} {...props}>
      {BUTTONS.map(([shape, x]) => (
        <g key={shape} transform={`translate(${x} ${BUTTON_Y})`}>
          <IdleButton shape={shape} />
        </g>
      ))}

      {/* Câu 1: khung tròn → hình to */}
      <Question k="q1">
        <A k="f1" x={FRAME[0]} y={FRAME[1]}>
          <RoundFrame />
          <NavonTriangle />
        </A>
        <A k="sel1" x={PICK_1[0]} y={PICK_1[1]}>
          <PickedButton shape="triangle" />
        </A>
        <Mark k="ok1" x={PICK_1[0] + 32} y={PICK_1[1] - 30} kind="ok" />
      </Question>

      {/* Câu 2: khung vuông → hình nhỏ */}
      <Question k="q2">
        <A k="f2" x={FRAME[0]} y={FRAME[1]}>
          <SquareFrame />
          <NavonTriangle />
        </A>
        <A k="sel2" x={PICK_2[0]} y={PICK_2[1]}>
          <PickedButton shape="circle" />
        </A>
        <Mark k="ok2" x={PICK_2[0] + 32} y={PICK_2[1] - 30} kind="ok" />
      </Question>
      <Ripple k="rp1" x={PICK_1[0]} y={PICK_1[1]} />
      <Ripple k="rp2" x={PICK_2[0]} y={PICK_2[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
