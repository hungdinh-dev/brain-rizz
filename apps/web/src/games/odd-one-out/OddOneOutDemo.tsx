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
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { OddOneOutHowTo } from "./OddOneOutHowTo";

/** Tâm ô lưới 3 × 3 trong khung chơi 248 × 248 tại (196, 62). */
const XS = [248, 320, 392] as const;
const YS = [114, 186, 258] as const;
const CELLS = YS.flatMap((y) => XS.map((x) => [x, y] as const));
/** Câu 1: hình tròn ở ô giữa phải; câu 2: hình hồng ở ô dưới trái. */
const ODD_1 = [392, 186] as const;
const ODD_2 = [248, 258] as const;

/**
 * Kịch bản Kẻ lạc đàn (UI-UX 6.11, T = 4.800 ms): câu 1 (8 tam giác + 1 hình tròn) → chạm → ✓;
 * chuyển câu; câu 2 (khác màu) → chạm nhanh → ✓ + ⚡.
 */
export const ODD_ONE_OUT_SCRIPT = defineScript({
  id: "oo",
  T: 4800,
  steps: [0, 1000, 2400],
  hand: {
    moves: [
      [500, 500, ODD_1],
      [1700, 450, ODD_2],
      [2900, 400, null],
    ],
    taps: [1100, 2250],
  },
  tracks: {
    q1: questionOut(1700),
    q2: questionIn(1900),
    c1: track().bump(1160, 1.3, 180),
    ring1: popIn(1160),
    ok1: popIn(1220),
    rp1: ripple(1100),
    c2: track().bump(2310, 1.3, 180),
    ring2: popIn(2310),
    ok2: popIn(2370),
    bolt: popIn(2450),
    rp2: ripple(2250),
  },
});

const isOdd = ([x, y]: readonly [number, number], odd: readonly [number, number]) =>
  x === odd[0] && y === odd[1];

/** Hình minh hoạ động Kẻ lạc đàn (màn Hướng dẫn); khung tĩnh = `OddOneOutHowTo`. */
export function OddOneOutDemo(props: DemoProps) {
  return (
    <DemoStage
      script={ODD_ONE_OUT_SCRIPT}
      still={OddOneOutHowTo}
      {...props}
      backdrop={
        <rect
          x={196}
          y={62}
          width={248}
          height={248}
          rx={18}
          className="fill-board-shade stroke-chalk/55 filter-[url(#chalk)]"
          strokeWidth={3}
        />
      }
    >
      <Question k="q1">
        <g fill="none" className="stroke-chalk" strokeWidth={4} strokeLinejoin="round">
          {CELLS.filter((c) => !isOdd(c, ODD_1)).map(([x, y]) => (
            <path
              key={`${x},${y}`}
              d={`M${x} ${y - 20} L${x + 21} ${y + 16} L${x - 21} ${y + 16} Z`}
            />
          ))}
        </g>
        <A k="c1" x={ODD_1[0]} y={ODD_1[1]}>
          <circle r={18} fill="none" className="stroke-chalk" strokeWidth={4} />
        </A>
        <Ring k="ring1" x={ODD_1[0]} y={ODD_1[1]} rx={33} />
        <Mark k="ok1" x={ODD_1[0] + 34} y={ODD_1[1] - 36} kind="ok" />
      </Question>
      <Question k="q2">
        <g className="fill-sky stroke-ink" strokeWidth={3}>
          {CELLS.filter((c) => !isOdd(c, ODD_2)).map(([x, y]) => (
            <circle key={`${x},${y}`} cx={x} cy={y} r={19} />
          ))}
        </g>
        <A k="c2" x={ODD_2[0]} y={ODD_2[1]}>
          <circle r={19} className="fill-memorize stroke-ink" strokeWidth={3} />
        </A>
        <Ring k="ring2" x={ODD_2[0]} y={ODD_2[1]} rx={33} />
        <Mark k="ok2" x={ODD_2[0] + 34} y={ODD_2[1] - 34} kind="ok" />
        <Mark k="bolt" x={ODD_2[0] + 72} y={ODD_2[1] - 34} kind="fast" />
      </Question>
      <Ripple k="rp1" x={ODD_1[0]} y={ODD_1[1]} />
      <Ripple k="rp2" x={ODD_2[0]} y={ODD_2[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
