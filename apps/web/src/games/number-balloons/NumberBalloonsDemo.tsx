import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  LockPill,
  Mark,
  NumberBadge,
  popIn,
  Question,
  questionIn,
  questionOut,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  type TrackBuilder,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { BALLOON_FILL, Balloon, NumberBalloonsHowTo } from "./NumberBalloonsHowTo";

type Point = readonly [number, number];

/** Khay 4 ô 46 phía trên, tâm x 239 · 293 · 347 · 401, y 43. */
const TRAY_XS = [239, 293, 347, 401] as const;
const TRAY_Y = 43;
/** Bốn chỗ bóng (rx 32, ry 38). */
const TOP_LEFT: Point = [230, 150];
const TOP_RIGHT: Point = [410, 150];
const BOTTOM_LEFT: Point = [230, 272];
const BOTTOM_RIGHT: Point = [410, 272];

/** Một quả bị nổ: chỗ, số, màu, mốc chạm, ô khay nhận số. */
interface Pop {
  id: string;
  at: Point;
  value: number;
  fill: string;
  tap: number;
  slot: number;
  /** Mốc phồng lên (câu 1: 100, câu 2: 3.000). */
  inflate: number;
}

/** Câu 1: nổ 3 → 5 → 8 → 12 (vẽ 8, 12 trước để số bay lên khay nằm trên bóng). */
const Q1: Pop[] = [
  { id: "8", at: TOP_LEFT, value: 8, fill: BALLOON_FILL.yellow, tap: 1900, slot: 2, inflate: 100 },
  {
    id: "12",
    at: TOP_RIGHT,
    value: 12,
    fill: BALLOON_FILL.lavender,
    tap: 2350,
    slot: 3,
    inflate: 100,
  },
  { id: "3", at: BOTTOM_LEFT, value: 3, fill: BALLOON_FILL.pink, tap: 1000, slot: 0, inflate: 100 },
  {
    id: "5",
    at: BOTTOM_RIGHT,
    value: 5,
    fill: BALLOON_FILL.mint,
    tap: 1450,
    slot: 1,
    inflate: 100,
  },
];
/** Câu 2: nổ đúng quả 2, rồi chạm nhầm 7 (lẽ ra là 4). */
const Q2_POP: Pop = {
  id: "2",
  at: TOP_RIGHT,
  value: 2,
  fill: BALLOON_FILL.yellow,
  tap: 3350,
  slot: 0,
  inflate: 3000,
};
const WRONG_TAP = 3850;

/** Ba mảnh vỡ: hướng bay (x, y) và góc xoay. */
const SHARDS = [
  [-44, -24, -40],
  [42, -16, 50],
  [-28, 40, 25],
] as const;

/** Làn của một quả nổ: phồng 1,2 (80 ms) rồi vỡ 1,35 + mờ (120 ms); mảnh, vòng "bụp", số bay vào khay. */
function popTracks({ id, at, tap, slot, inflate }: Pop): Record<string, TrackBuilder> {
  const tracks: Record<string, TrackBuilder> = {
    [`B${id}`]: track({ s: 0.6, o: 0 })
      .pop(inflate, 200)
      .to(tap, 80, { s: 1.2 })
      .to(tap + 80, 120, { s: 1.35, o: 0 }),
    [`P${id}`]: track({ s: 0.5, o: 0 })
      .jump(tap + 80, { o: 0.9 })
      .to(tap + 81, 249, { s: 1.2, o: 0 }),
    [`R${id}`]: ripple(tap),
    [`K${id}`]: track({ o: 0 }).fade(tap + 250, 80),
    [`F${id}`]: track({ o: 0 })
      .jump(tap + 60, { o: 1 })
      .to(tap + 61, 249, {
        x: (TRAY_XS[slot] as number) - at[0],
        y: TRAY_Y - at[1] - 2,
        s: 0.8,
      }),
  };
  SHARDS.forEach(([x, y, r], i) => {
    tracks[`S${id}${i}`] = track({ o: 0 })
      .jump(tap + 80, { o: 1 })
      .to(tap + 81, 249, { x, y, r, o: 0 });
  });
  return tracks;
}

/**
 * Kịch bản Bóng bay số (UI-UX 6.11, T = 6.200 ms): câu 1 nổ 3 → 5 → 8 → 12 vào khay → ✓; câu 2
 * nổ 2 rồi chạm nhầm 7 → ✗ + rung, bóng còn lại mờ, vòng nhịp quanh quả 4, thứ tự đúng ② ③ ④,
 * nhãn khoá rút ngắn 1,2 s.
 */
export const NUMBER_BALLOONS_SCRIPT = defineScript({
  id: "nb",
  T: 6200,
  steps: [0, 1000, 3000],
  hand: {
    moves: [
      [400, 500, [BOTTOM_LEFT[0], BOTTOM_LEFT[1] + 2]],
      [1150, 250, [BOTTOM_RIGHT[0], BOTTOM_RIGHT[1] + 2]],
      [1600, 250, [TOP_LEFT[0], TOP_LEFT[1] + 2]],
      [2050, 250, [TOP_RIGHT[0], TOP_RIGHT[1] + 2]],
      [3500, 300, [BOTTOM_LEFT[0], BOTTOM_LEFT[1] + 2]],
      [4200, 400, null],
    ],
    taps: [1000, 1450, 1900, 2350, Q2_POP.tap, WRONG_TAP],
  },
  tracks: {
    q1: questionOut(2800),
    q2: questionIn(3000),
    hint: popIn(550).fade(1000, 150, 0),
    ...Object.fromEntries(Q1.flatMap((pop) => Object.entries(popTracks(pop)))),
    ok: popIn(2450),
    ...popTracks(Q2_POP),
    B7: track({ s: 0.6, o: 0 })
      .pop(3000, 200)
      .shake(WRONG_TAP + 60),
    R7: ripple(WRONG_TAP),
    B9: track({ s: 0.6, o: 0 }).pop(3000, 200),
    B4: track({ s: 0.6, o: 0 }).pop(3000, 200),
    dim: track().fade(3950, 150, 0.6),
    ring4: track({ s: 0.6, o: 0 })
      .pop(4000)
      .to(4300, 150, { s: 1.08 }, "glide")
      .to(4450, 150, { s: 1 }, "glide")
      .to(4600, 150, { s: 1.08 }, "glide")
      .to(4750, 150, { s: 1 }, "glide"),
    x7: popIn(WRONG_TAP + 60),
    o4: popIn(4050),
    o7: popIn(4110),
    o9: popIn(4170),
    lk: popIn(4000),
    lkb: track().to(4100, 1200, { sx: 0 }, "linear"),
  },
});

/** Ô khay đã nhận số: thẻ giấy viền mực. */
function TrayCard() {
  return (
    <>
      <rect x={-23} y={-20} width={46} height={46} rx={10} className="fill-ink" />
      <rect
        x={-23}
        y={-23}
        width={46}
        height={46}
        rx={10}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
    </>
  );
}

/** Một quả bóng sẽ nổ: thân, 3 mảnh, vòng "bụp", sóng chạm, ô khay và số bay lên khay. */
function PoppingBalloon({ id, at: [x, y], value, fill, slot }: Pop) {
  return (
    <>
      <A k={`B${id}`} x={x} y={y}>
        <Balloon x={0} y={0} fill={fill} value={value} />
      </A>
      {SHARDS.map(([dx], i) => (
        <A key={dx} k={`S${id}${i}`} x={x} y={y}>
          <path
            d="M-6 -6 L7 -3 L-1 7 Z"
            fill={fill}
            className="stroke-ink"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </A>
      ))}
      <A k={`P${id}`} x={x} y={y}>
        <circle r={42} fill="none" className="stroke-chalk" strokeWidth={3} strokeDasharray="6 6" />
      </A>
      <Ripple k={`R${id}`} x={x} y={y} />
      <A k={`K${id}`} x={TRAY_XS[slot]} y={TRAY_Y}>
        <TrayCard />
      </A>
      <A k={`F${id}`} x={x} y={y}>
        <text
          y={11}
          textAnchor="middle"
          fontSize={30}
          className="fill-ink font-display font-extrabold"
        >
          {value}
        </text>
      </A>
    </>
  );
}

/** Hình minh hoạ động Bóng bay số (màn Hướng dẫn); khung tĩnh = `NumberBalloonsHowTo`. */
export function NumberBalloonsDemo(props: DemoProps) {
  return (
    <DemoStage
      script={NUMBER_BALLOONS_SCRIPT}
      still={NumberBalloonsHowTo}
      {...props}
      backdrop={
        <g
          className="fill-board-shade stroke-chalk/80 filter-[url(#chalk)]"
          strokeWidth={2.5}
          strokeDasharray="7 5"
        >
          {TRAY_XS.map((x) => (
            <rect key={x} x={x - 23} y={TRAY_Y - 23} width={46} height={46} rx={10} />
          ))}
        </g>
      }
    >
      <Question k="q1">
        <Ring k="hint" x={BOTTOM_LEFT[0]} y={BOTTOM_LEFT[1]} rx={46} ry={50} />
        {Q1.map((pop) => (
          <PoppingBalloon key={pop.id} {...pop} />
        ))}
        <Mark k="ok" x={452} y={TRAY_Y} kind="ok" />
      </Question>
      <Question k="q2">
        <PoppingBalloon {...Q2_POP} />
        <A k="B7" x={BOTTOM_LEFT[0]} y={BOTTOM_LEFT[1]}>
          <Balloon x={0} y={0} fill={BALLOON_FILL.pink} value={7} />
        </A>
        <Ripple k="R7" x={BOTTOM_LEFT[0]} y={BOTTOM_LEFT[1]} />
        <A k="dim">
          <A k="B9" x={TOP_LEFT[0]} y={TOP_LEFT[1]}>
            <Balloon x={0} y={0} fill={BALLOON_FILL.mint} value={9} />
          </A>
          <A k="B4" x={BOTTOM_RIGHT[0]} y={BOTTOM_RIGHT[1]}>
            <Balloon x={0} y={0} fill={BALLOON_FILL.lavender} value={4} />
          </A>
        </A>
        <A k="ring4" x={BOTTOM_RIGHT[0]} y={BOTTOM_RIGHT[1]}>
          <circle r={52} fill="none" className="stroke-ink" strokeWidth={7} strokeDasharray="9 8" />
          <circle
            r={52}
            fill="none"
            className="stroke-chalk"
            strokeWidth={3.5}
            strokeDasharray="9 8"
          />
        </A>
        <Mark k="x7" x={BOTTOM_LEFT[0] + 32} y={BOTTOM_LEFT[1] - 36} kind="bad" />
        <NumberBadge k="o4" x={BOTTOM_RIGHT[0] + 36} y={BOTTOM_RIGHT[1] - 36} n={2} />
        <NumberBadge k="o7" x={BOTTOM_LEFT[0] - 36} y={BOTTOM_LEFT[1] - 36} n={3} />
        <NumberBadge k="o9" x={TOP_LEFT[0] - 36} y={TOP_LEFT[1] - 36} n={4} />
        <LockPill k="lk" kb="lkb" x={486} y={TRAY_Y} />
      </Question>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
