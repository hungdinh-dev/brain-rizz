import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { AimTrainerHowTo, Bullseye } from "./AimTrainerHowTo";

type Point = readonly [number, number];

/** Khung chơi dọc 5 : 7 (200 × 280) giữa sân khấu, như khung của scene. */
const FIELD = { x: 220, y: 40, w: 200, h: 280 } as const;
/** Bán kính bia (bia vừa, mức Thường/Khó). */
const R = 34;
/** Ba tấm bia lần lượt: bia 1 có sẵn, trúng thì bia 2 hiện ngay, trúng bia 2 thì bia 3 hiện. */
const T1: Point = [276, 250];
const T2: Point = [366, 112];
const T3: Point = [292, 150];
/** Mốc chạm bia 1, bia 2; bia 3 co dần rồi biến mất lúc `VANISH` (không ai chạm kịp). */
const TAP_1 = 1000;
const TAP_2 = 1650;
const VANISH = 3050;
const MISS = VANISH + 80;

/** Sao vàng bung khi trúng: 16 cánh, ngoài 1,45 r, trong 0,55 (như `BURST` của scene). */
const BURST_PATH = (() => {
  const points = 16;
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = (i % 2 === 0 ? 1.45 : 1.45 * 0.55) * R;
    parts.push(
      `${i === 0 ? "M" : "L"}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`,
    );
  }
  return `${parts.join(" ")} Z`;
})();

/** Hai chỗ sao bung (bia 1, bia 2). */
const BURSTS: readonly { k: string; at: Point }[] = [
  { k: "b1", at: T1 },
  { k: "b2", at: T2 },
];

/** Sao bung tại chỗ bia vừa trúng: 0,6 → 1,2 và tan trong 200 ms. */
const burst = (at: number) =>
  track({ s: 0.6, o: 0 })
    .jump(at, { o: 1 })
    .to(at + 1, 199, { s: 1.2, o: 0 });

/** Bia hiện: bật từ 80 % lên 100 % trong 80 ms (như scene). */
const appear = (at: number) => track({ s: 0.8, o: 0 }).to(at, 80, { s: 1, o: 1 });

/**
 * Kịch bản Luyện ngắm (CR-021, T = 4.600 ms): chạm trúng bia 1 → sao bung, bia 2 hiện ngay ở chỗ
 * khác → chạm trúng → bia 3 hiện, co dần (vòng nét đứt giữ vùng chấm) và biến mất vì không ai chạm
 * kịp → bia mờ trong vòng vàng nét đứt + đồng hồ + ✗ (bỏ lỡ).
 */
export const AIM_TRAINER_SCRIPT = defineScript({
  id: "at",
  T: 4600,
  steps: [0, 1250, 2200],
  hand: {
    moves: [
      [450, 500, T1],
      [1250, 300, T2],
      [2000, 400, null],
    ],
    taps: [TAP_1, TAP_2],
  },
  tracks: {
    t1: track().jump(TAP_1, { o: 0 }),
    t2: appear(TAP_1).jump(TAP_2, { o: 0 }),
    t3: appear(TAP_2)
      .to(TAP_2 + 80, VANISH - TAP_2 - 80, { s: 0.4 }, "linear")
      .to(VANISH, 80, { o: 0 }, "linear"),
    zone: track({ o: 0 }).jump(TAP_2, { o: 1 }).jump(VANISH, { o: 0 }),
    b1: burst(TAP_1),
    b2: burst(TAP_2),
    rp1: ripple(TAP_1),
    rp2: ripple(TAP_2),
    ok1: popIn(TAP_1 + 120).fade(TAP_1 + 520, 150, 0),
    ok2: popIn(TAP_2 + 120).fade(TAP_2 + 520, 150, 0),
    miss: track({ o: 0 }).fade(MISS, 150),
    clock: popIn(MISS + 60),
    bad: popIn(MISS + 60),
  },
});

/** Biểu tượng đồng hồ của trạng thái bỏ lỡ: tròn giấy viền mực, hai kim. */
function Clock() {
  return (
    <>
      <circle cy={2} r={15} className="fill-ink" />
      <circle r={15} className="fill-paper stroke-ink" strokeWidth={3} />
      <path
        d="M0 -8 L0 0 L6 4"
        fill="none"
        className="stroke-ink"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Hình minh hoạ động Luyện ngắm (màn Hướng dẫn); khung tĩnh = `AimTrainerHowTo`. */
export function AimTrainerDemo(props: DemoProps) {
  return (
    <DemoStage
      script={AIM_TRAINER_SCRIPT}
      still={AimTrainerHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          <rect
            x={FIELD.x}
            y={FIELD.y}
            width={FIELD.w}
            height={FIELD.h}
            rx={18}
            className="fill-board-shade stroke-chalk/60"
            strokeWidth={3}
          />
          <rect
            x={FIELD.x + 7}
            y={FIELD.y + 7}
            width={FIELD.w - 14}
            height={FIELD.h - 14}
            rx={13}
            fill="none"
            className="stroke-identify/55"
            strokeWidth={3}
          />
        </g>
      }
    >
      <A k="t1" x={T1[0]} y={T1[1]}>
        <Bullseye x={0} y={0} r={R} />
      </A>
      <A k="t2" x={T2[0]} y={T2[1]}>
        <Bullseye x={0} y={0} r={R} />
      </A>
      {/* Bia 3: vòng mờ nét đứt cỡ r giữ vùng chấm trong lúc đĩa co dần */}
      <A k="zone" x={T3[0]} y={T3[1]}>
        <circle
          r={R}
          fill="none"
          className="stroke-chalk/60"
          strokeWidth={3}
          strokeDasharray="7 6"
        />
      </A>
      <A k="t3" x={T3[0]} y={T3[1]}>
        <Bullseye x={0} y={0} r={R} />
      </A>
      {/* Bỏ lỡ: bia mờ 50 % trong vòng vàng nét đứt */}
      <A k="miss" x={T3[0]} y={T3[1]}>
        <g opacity={0.5}>
          <Bullseye x={0} y={0} r={R} />
        </g>
        <circle
          r={R + 12}
          fill="none"
          className="stroke-ink"
          strokeWidth={8}
          strokeDasharray="10 7"
        />
        <circle
          r={R + 12}
          fill="none"
          className="stroke-primary"
          strokeWidth={4.5}
          strokeDasharray="10 7"
        />
      </A>
      <A k="clock" x={T3[0] - 40} y={T3[1] + 40}>
        <Clock />
      </A>
      <Mark k="bad" x={T3[0] + 40} y={T3[1] - 40} kind="bad" />
      {BURSTS.map(({ k, at: [x, y] }) => (
        <A key={k} k={k} x={x} y={y}>
          <path
            d={BURST_PATH}
            fill="none"
            className="stroke-sun"
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </A>
      ))}
      <Mark k="ok1" x={T1[0] + 42} y={T1[1] - 40} kind="ok" />
      <Mark k="ok2" x={T2[0] - 44} y={T2[1] + 36} kind="ok" />
      <Ripple k="rp1" x={T1[0]} y={T1[1]} />
      <Ripple k="rp2" x={T2[0]} y={T2[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
