import { useId } from "react";
import { A, Cursor, DemoStage, defineScript, Mark, popIn, StepBadge, track } from "../_shared/demo";
import type { DemoProps } from "../types";
import {
  BUTTON_ARROW,
  ChalkArrowsHowTo,
  DOUBLE,
  GUIDE_SMALL,
  SOLID,
  type Tone,
  Trail,
  YELLOW,
} from "./ChalkArrowsHowTo";

type Point = readonly [number, number];

/** Bảng phấn 248 × 220 giữa sân khấu; nhóm mũi tên quanh tâm (320, 134). */
const BOARD = { x: 196, y: 24, w: 248, h: 220 } as const;
const GROUP: Point = [314, 134];
/** Bốn mũi tên của nhóm (lệch so với tâm nhóm), cùng màu, cùng hướng chỉ, cùng hướng trượt. */
const ARROWS: readonly Point[] = [
  [-72, -34],
  [8, -56],
  [62, 14],
  [-26, 50],
];
const ARROW_SCALE = 0.42;

/** Hàng 4 nút hướng như scene: ← ↑ ↓ → (góc xoay của mũi tên trên nút). */
const BUTTON_Y = 296;
const BUTTONS = [
  { x: 236, rotate: -90 },
  { x: 292, rotate: 0 },
  { x: 348, rotate: 180 },
  { x: 404, rotate: 90 },
] as const;
const UP = BUTTONS[1];
const RIGHT = BUTTONS[3];

/** Câu 1: phấn trắng chỉ LÊN, trượt PHẢI → vuốt lên. Câu 2: phấn vàng chỉ LÊN, trượt PHẢI → vuốt phải. */
const SWIPE_1 = { at: 1050, from: [320, 206] as Point, to: [320, 112] as Point };
const SWIPE_2 = { at: 2350, from: [254, 150] as Point, to: [384, 150] as Point };
/** Nhóm vụt ra khỏi bảng theo hướng vuốt, sau khi tay vuốt xong. */
const FLY_1 = SWIPE_1.at + 250;
const FLY_2 = SWIPE_2.at + 250;
const Q2_IN = 1950;

/** Vệt vuốt: dài ra từ điểm đầu (phóng 0,2 → 1 theo trục vuốt) rồi mờ. */
const streak = (at: number, axis: "sx" | "sy") =>
  track({ [axis]: 0.2, o: 0 })
    .jump(at, { o: 1 })
    .to(at + 1, 249, { [axis]: 1 })
    .fade(at + 450, 200, 0);

/** Nút sáng vàng lúc nhận hướng rồi tắt. */
const lit = (at: number, off: number) => track({ o: 0 }).fade(at, 80).fade(off, 150, 0);

/**
 * Kịch bản Phấn trượt (CR-021, T = 4.800 ms): câu 1 phấn trắng chỉ lên, trượt phải → vuốt lên (theo
 * mũi), nút ↑ sáng, nhóm vụt lên → ✓; câu 2 phấn vàng cùng hướng → vuốt phải (theo trượt), nút →
 * sáng → ✓; bước ③ hiện lại hai luật: trắng theo mũi, vàng theo trượt.
 */
export const CHALK_ARROWS_SCRIPT = defineScript({
  id: "ca",
  T: 4800,
  steps: [0, Q2_IN, 2900],
  hand: {
    moves: [
      [500, 450, SWIPE_1.from],
      [SWIPE_1.at, 250, SWIPE_1.to],
      [1800, 400, SWIPE_2.from],
      [SWIPE_2.at, 250, SWIPE_2.to],
      [2900, 400, null],
    ],
    taps: [SWIPE_1.at, SWIPE_2.at],
  },
  tracks: {
    sl1: track().to(0, FLY_1, { x: 34 }, "linear"),
    f1: track().to(FLY_1, 260, { y: -250, o: 0 }, "glide"),
    q2: track({ o: 0 }).fade(Q2_IN, 150),
    sl2: track().to(Q2_IN, FLY_2 - Q2_IN, { x: 34 }, "linear"),
    f2: track().to(FLY_2, 260, { x: 260, o: 0 }, "glide"),
    sw1: streak(SWIPE_1.at, "sy"),
    sw2: streak(SWIPE_2.at, "sx"),
    bu: lit(FLY_1, 1800),
    br: lit(FLY_2, 3300),
    ok1: popIn(FLY_1 + 60).fade(1800, 150, 0),
    ok2: popIn(FLY_2 + 60),
    lg1: popIn(2950),
    lg2: popIn(3100),
  },
});

/** Mũi tên phấn chỉ LÊN (nét trơn, không filter vì nằm ở lớp động): trắng nét liền, vàng nét đôi. */
function PlainArrow({ tone }: { tone: Tone }) {
  const white = tone === "white";
  const d = white ? SOLID : DOUBLE;
  const width = white ? 13 : 8;
  return (
    <g
      className={white ? "stroke-chalk" : undefined}
      stroke={white ? undefined : YELLOW}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} strokeWidth={width + 8} strokeOpacity={0.15} />
      <path d={d} strokeWidth={width} />
    </g>
  );
}

/** Nhóm 4 mũi tên chỉ lên, đang trượt sang phải (vệt bụi bên trái). */
function Group({ tone }: { tone: Tone }) {
  return (
    <>
      {ARROWS.map(([dx, dy]) => (
        <g key={`${dx},${dy}`} transform={`translate(${dx} ${dy}) scale(${ARROW_SCALE})`}>
          <g transform="rotate(90)">
            <Trail tone={tone} />
          </g>
          <PlainArrow tone={tone} />
        </g>
      ))}
    </>
  );
}

/** Nút hướng đang sáng: nền vàng viền mực, mũi tên mực. */
function LitButton({ rotate }: { rotate: number }) {
  return (
    <>
      <rect x={-26} y={-19} width={52} height={44} rx={12} className="fill-ink" />
      <rect
        x={-26}
        y={-22}
        width={52}
        height={44}
        rx={12}
        className="fill-primary stroke-ink"
        strokeWidth={3}
      />
      <path
        d={BUTTON_ARROW}
        transform={`rotate(${rotate}) scale(0.85)`}
        fill="none"
        className="stroke-ink"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Vệt vuốt phấn: thân + đầu mũi tên, hướng LÊN (gốc = điểm bắt đầu vuốt). */
function Streak({ rotate }: { rotate: number }) {
  return (
    <g transform={`rotate(${rotate})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 0 L0 -84 M-12 -70 L0 -84 L12 -70" className="stroke-ink" strokeWidth={9} />
      <path d="M0 0 L0 -84 M-12 -70 L0 -84 L12 -70" className="stroke-primary" strokeWidth={5} />
    </g>
  );
}

/** Hình minh hoạ động Phấn trượt (màn Hướng dẫn); khung tĩnh = `ChalkArrowsHowTo`. */
export function ChalkArrowsDemo(props: DemoProps) {
  // Id của vùng cắt phải duy nhất trên trang; bỏ ký tự đặc biệt để dùng được trong url(#…).
  const clipId = `ca-board-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <DemoStage
      script={CHALK_ARROWS_SCRIPT}
      still={ChalkArrowsHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          <rect
            x={BOARD.x}
            y={BOARD.y}
            width={BOARD.w}
            height={BOARD.h}
            rx={16}
            className="fill-board-shade stroke-chalk"
            strokeWidth={3.5}
          />
          {BUTTONS.map(({ x, rotate }) => (
            <g key={x} transform={`translate(${x} ${BUTTON_Y})`}>
              <rect
                x={-26}
                y={-22}
                width={52}
                height={44}
                rx={12}
                fill="none"
                className="stroke-chalk/70"
                strokeWidth={3}
              />
              <path
                d={BUTTON_ARROW}
                transform={`rotate(${rotate}) scale(0.85)`}
                fill="none"
                className="stroke-chalk"
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
      }
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={BOARD.x + 2} y={BOARD.y + 2} width={BOARD.w - 4} height={BOARD.h - 4} rx={14} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <A k="f1" x={GROUP[0]} y={GROUP[1]}>
          <A k="sl1">
            <Group tone="white" />
          </A>
        </A>
        <A k="q2" x={GROUP[0]} y={GROUP[1]}>
          <A k="f2">
            <A k="sl2">
              <Group tone="yellow" />
            </A>
          </A>
        </A>
      </g>
      <A k="sw1" x={SWIPE_1.from[0]} y={SWIPE_1.from[1]}>
        <Streak rotate={0} />
      </A>
      <A k="sw2" x={SWIPE_2.from[0]} y={SWIPE_2.from[1]}>
        <Streak rotate={90} />
      </A>
      <A k="bu" x={UP.x} y={BUTTON_Y}>
        <LitButton rotate={UP.rotate} />
      </A>
      <A k="br" x={RIGHT.x} y={BUTTON_Y}>
        <LitButton rotate={RIGHT.rotate} />
      </A>
      <Mark k="ok1" x={UP.x + 28} y={BUTTON_Y - 30} kind="ok" />
      <Mark k="ok2" x={RIGHT.x + 28} y={BUTTON_Y - 30} kind="ok" />

      {/* Bước ③: luật theo màu phấn, bên trái bảng. Trắng → đầu mũi tên (khoanh vàng); vàng → hướng trượt */}
      <A k="lg1" x={120} y={118}>
        <g transform={`scale(${ARROW_SCALE})`}>
          <PlainArrow tone="white" />
        </g>
        <circle cy={-24} r={11} fill="none" className="stroke-ink" strokeWidth={7} />
        <circle cy={-24} r={11} fill="none" className="stroke-primary" strokeWidth={3.5} />
      </A>
      <A k="lg2" x={110} y={200}>
        <g transform={`scale(${ARROW_SCALE})`}>
          <g transform="rotate(90)">
            <Trail tone="yellow" />
          </g>
          <PlainArrow tone="yellow" />
        </g>
        <g transform="translate(26 0)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={GUIDE_SMALL} className="stroke-ink" strokeWidth={9} />
          <path d={GUIDE_SMALL} className="stroke-primary" strokeWidth={4.5} />
        </g>
      </A>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
