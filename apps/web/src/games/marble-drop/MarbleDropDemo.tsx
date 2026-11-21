import { cn } from "@/lib/utils";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { ARROW, Ball, CUP, FLIP_ICON, MarbleDropHowTo, TILT } from "./MarbleDropHowTo";

type Point = readonly [number, number];

/** Nét phấn sần cho lớp tĩnh (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/**
 * Khung dọc như màn chơi mức Mầm (2 tầng, 3 cốc), dời từ `MarbleDropHowTo` sang phải 40 để chừa cột
 * công tắc bên phải. Cần gạt: dương = chỉ trái, âm = chỉ phải.
 */
const LEVERS = [
  { at: [325, 88] as Point, tilt: -TILT },
  { at: [288, 176.8] as Point, tilt: TILT },
  { at: [362, 176.8] as Point, tilt: TILT },
] as const;
const PIPES =
  "M325 50 L325 88 M288 176.8 L325 88 L362 176.8 M251 265.6 L288 176.8 L325 265.6 M325 265.6 L362 176.8 L399 265.6 M251 265.6 L251 276 M325 265.6 L325 276 M399 265.6 L399 276";
const CUPS = [
  { x: 251, letter: "A" },
  { x: 325, letter: "B" },
  { x: 399, letter: "C" },
] as const;
const CUP_Y = 292;
/** Cần gạt to hơn hình tĩnh một chút để thấy rõ hướng trên khung nhỏ. */
const LEVER_SIZE = 0.58;
/** Đường bi được hỏi: phễu → cần gạt 1 (phải) → cần gạt 3 (trái) → cốc B. */
const PATH: readonly Point[] = [
  [325, 40],
  [325, 88],
  [362, 176.8],
  [325, 265.6],
  [325, 298],
];
/** Mốc dấu lần theo tới từng điểm của `PATH` (điểm đầu hiện lúc 300). */
const TRACE_AT = [300, 600, 1000, 1400, 1650] as const;

/** Cột công tắc (bước ③): chốt vàng tại (520, 160), hai nhánh xuống hai cốc nhỏ. */
const SWITCH: Point = [520, 160];
const BRANCH_DX = 25.6;
const BRANCH_Y = 221.4;
const BIN_Y = 248;
const SWITCH_PIPES = `M520 96 L520 160 M${520 - BRANCH_DX} ${BRANCH_Y} L520 160 L${520 + BRANCH_DX} ${BRANCH_Y} M${520 - BRANCH_DX} ${BRANCH_Y} L${520 - BRANCH_DX} ${BIN_Y - 6} M${520 + BRANCH_DX} ${BRANCH_Y} L${520 + BRANCH_DX} ${BIN_Y - 6}`;
/** Bi 1 qua công tắc thì rẽ trái; công tắc lật; bi 2 qua thì rẽ phải. */
const FLIP_AT = 3400;

const TAP = 2250;

/** Bi lăn theo chuỗi điểm: mỗi chặng [mốc bắt đầu, thời lượng, điểm tới]. */
function roll(start: Point, legs: readonly (readonly [number, number, Point])[]) {
  const t = track({ x: start[0], y: start[1] });
  for (const [at, dur, [x, y]] of legs) t.to(at, dur, { x, y }, "linear");
  return t;
}

/** Một đoạn nét đứt của đường lần theo: hiện dần trong lúc dấu lần theo chạy qua. */
const segment = (i: number) =>
  track({ o: 0 }).fade(
    TRACE_AT[i] as number,
    (TRACE_AT[i + 1] as number) - (TRACE_AT[i] as number),
    1,
    "linear",
  );

/**
 * Kịch bản Bi rơi đâu (CR-021, T = 5.200 ms): dấu lần theo chạy từ phễu qua từng cần gạt, để lại
 * nét đứt vàng (cần gạt nảy khi dấu đi qua) → chạm cốc B → bi vàng nhảy vào cốc + ✓; bước ③ cột
 * công tắc: bi 1 rẽ trái, công tắc lật (bóng nét đứt ở chỗ cũ), bi 2 rẽ phải.
 */
export const MARBLE_DROP_SCRIPT = defineScript({
  id: "md",
  T: 5200,
  steps: [0, 1700, 2900],
  hand: {
    moves: [
      [1700, 450, [325, 312]],
      [2800, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    tr: track({ x: 325, y: 40, o: 0 })
      .fade(150, 150)
      .to(TRACE_AT[0], 300, { x: 325, y: 88 }, "linear")
      .to(TRACE_AT[1], 400, { x: 362, y: 176.8 }, "linear")
      .to(TRACE_AT[2], 400, { x: 325, y: 265.6 }, "linear")
      .to(TRACE_AT[3], 250, { x: 325, y: 298 }, "linear")
      .fade(TRACE_AT[4], 150, 0),
    seg0: segment(0),
    seg1: segment(1),
    seg2: segment(2),
    seg3: segment(3),
    head: popIn(TRACE_AT[4]),
    lv0: track().bump(TRACE_AT[1], 1.15, 200),
    lv2: track().bump(TRACE_AT[2], 1.15, 200),
    ball: track({ x: 325, y: 36 }).to(TAP + 60, 260, { y: CUP_Y - 2 }, "settle"),
    cupB: track().bump(TAP + 320, 1.08, 160),
    ring: popIn(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
    // Cột công tắc
    b1: roll(
      [520, 112],
      [
        [3000, 300, SWITCH],
        [3300, 250, [520 - BRANCH_DX, BRANCH_Y]],
        [3550, 150, [520 - BRANCH_DX, BIN_Y]],
      ],
    ),
    b2: roll(
      [520, 88],
      [
        [3000, 200, [520, 112]],
        [3700, 250, SWITCH],
        [3950, 250, [520 + BRANCH_DX, BRANCH_Y]],
        [4200, 150, [520 + BRANCH_DX, BIN_Y]],
      ],
    ),
    sw: track({ r: TILT }).to(FLIP_AT, 220, { r: -TILT }, "pop"),
    pin: track().bump(FLIP_AT, 1.25, 220),
    ghost: track({ o: 0 }).fade(FLIP_AT + 100, 150),
  },
});

/** Cần gạt hình mũi tên (nét trơn ở lớp động), xoay quanh chốt. */
function Lever({ size }: { size: number }) {
  return (
    <path
      d={ARROW}
      transform={`scale(${size})`}
      className="fill-analyze stroke-chalk"
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

/** Chốt cần gạt thường: tròn bảng viền phấn, chấm giữa. */
function Pin() {
  return (
    <>
      <circle r={8} className="fill-board stroke-chalk" strokeWidth={2.5} />
      <circle r={2.5} className="fill-chalk" />
    </>
  );
}

/** Cốc đựng bi (nét trơn), gốc ở giữa miệng cốc. */
function Cup() {
  return (
    <g transform="scale(0.44)" className="stroke-chalk">
      <path d={CUP} className="fill-board-shade" strokeWidth={5.5} strokeLinejoin="round" />
      <ellipse rx={44} ry={12} className="fill-ink/50" strokeWidth={5.5} />
    </g>
  );
}

/** Bi số (bi 1, bi 2 ở cột công tắc). */
function NumberedBall({ n, gold }: { n: number; gold?: boolean }) {
  return (
    <>
      <Ball x={0} y={0} gold={gold} />
      <text
        y={5}
        textAnchor="middle"
        fontSize={14}
        className="fill-ink font-display font-extrabold"
      >
        {n}
      </text>
    </>
  );
}

/** Hình minh hoạ động Bi rơi đâu (màn Hướng dẫn); khung tĩnh = `MarbleDropHowTo`. */
export function MarbleDropDemo(props: DemoProps) {
  return (
    <DemoStage
      script={MARBLE_DROP_SCRIPT}
      still={MarbleDropHowTo}
      {...props}
      backdrop={
        <>
          <rect
            x={200}
            y={12}
            width={250}
            height={336}
            rx={18}
            className={cn(CHALK, "fill-board-shade stroke-chalk/85")}
            strokeWidth={3}
          />
          <g className={CHALK} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={`${PIPES} ${SWITCH_PIPES}`} className="stroke-chalk" strokeWidth={14} />
            <path d={`${PIPES} ${SWITCH_PIPES}`} className="stroke-board" strokeWidth={8} />
          </g>
          <path
            d="M298.1 24 L351.9 24 L333.4 55.1 L316.6 55.1 Z"
            className={cn(CHALK, "fill-board stroke-chalk")}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {CUPS.map(({ x, letter }) => (
            <g key={letter}>
              <text
                x={x}
                y={CUP_Y + 32.6}
                textAnchor="middle"
                className={cn(CHALK, "fill-chalk font-display text-[20px] font-extrabold")}
              >
                {letter}
              </text>
            </g>
          ))}
          {[-BRANCH_DX, BRANCH_DX].map((dx) => (
            <g
              key={dx}
              transform={`translate(${520 + dx} ${BIN_Y}) scale(0.3)`}
              className={cn(CHALK, "stroke-chalk")}
            >
              <path d={CUP} className="fill-board-shade" strokeWidth={6} strokeLinejoin="round" />
              <ellipse rx={44} ry={12} className="fill-ink/50" strokeWidth={6} />
            </g>
          ))}
        </>
      }
    >
      {/* Đường lần theo: nét đứt vàng từng đoạn + mũi tên vào cốc */}
      <g fill="none" className="stroke-primary" strokeWidth={4} strokeLinecap="round">
        {PATH.slice(0, -1).map(([x, y], i) => {
          const [nx, ny] = PATH[i + 1] as Point;
          return (
            <A key={`${x},${y}`} k={`seg${i}`}>
              <path d={`M${x} ${y} L${nx} ${ny}`} strokeDasharray="8 7" />
            </A>
          );
        })}
        <A k="head" x={325} y={298}>
          <path d="M-6 -8 L0 0 L6 -8" strokeLinejoin="round" />
        </A>
      </g>

      {LEVERS.map(({ at: [x, y], tilt }, i) => (
        <A key={`${x},${y}`} k={`lv${i}`} x={x} y={y}>
          <g transform={`rotate(${tilt})`}>
            <Lever size={LEVER_SIZE} />
          </g>
          <Pin />
        </A>
      ))}

      {/* Cốc (lớp động vì cốc B nảy khi bi vào); bi vàng nhảy thẳng xuống, nằm ở miệng cốc B */}
      {CUPS.map(({ x, letter }) =>
        letter === "B" ? (
          <A key={letter} k="cupB" x={x} y={CUP_Y}>
            <Cup />
          </A>
        ) : (
          <g key={letter} transform={`translate(${x} ${CUP_Y})`}>
            <Cup />
          </g>
        ),
      )}
      <A k="ball">
        <Ball x={0} y={0} gold />
      </A>

      {/* Dấu lần theo: vòng phấn nét đứt chạy dọc đường bi */}
      <A k="tr">
        <circle r={13} fill="none" className="stroke-chalk" strokeWidth={3} strokeDasharray="5 4" />
      </A>
      <Ring k="ring" x={325} y={CUP_Y + 22} rx={36} ry={32} />
      <Mark k="ok" x={370} y={CUP_Y - 8} kind="ok" />
      <Ripple k="rp" x={325} y={CUP_Y + 18} />

      {/* Cột công tắc: bóng nét đứt ở hướng cũ, cần gạt lật, chốt vàng có vòng mũi tên */}
      <A k="ghost" x={SWITCH[0]} y={SWITCH[1]}>
        <path
          d={ARROW}
          transform={`rotate(${TILT}) scale(${LEVER_SIZE})`}
          fill="none"
          className="stroke-chalk"
          strokeWidth={5}
          strokeDasharray="8 7"
          strokeLinejoin="round"
        />
      </A>
      <A k="sw" x={SWITCH[0]} y={SWITCH[1]}>
        <Lever size={LEVER_SIZE} />
      </A>
      <A k="pin" x={SWITCH[0]} y={SWITCH[1]}>
        <circle r={12} className="fill-primary stroke-chalk" strokeWidth={2.2} />
        <path
          d={FLIP_ICON}
          transform="scale(0.62)"
          fill="none"
          className="stroke-ink"
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </A>
      <A k="b2">
        <NumberedBall n={2} gold />
      </A>
      <A k="b1">
        <NumberedBall n={1} />
      </A>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
