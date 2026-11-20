import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  NumberBadge,
  popIn,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import { HAND_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { LightTrailHowTo } from "./LightTrailHowTo";
import { REWIND_PATH } from "./shapes";

/** Lưới 3 × 3 ô 60 (bước 72), tâm x 248 · 320 · 392, y 124 · 196 · 268. */
const XS = [248, 320, 392] as const;
const YS = [124, 196, 268] as const;
/** Ba đèn theo thứ tự: ô dưới trái, ô giữa trên, ô giữa phải. */
const TRAIL = [
  [248, 268],
  [320, 124],
  [392, 196],
] as const;
/** Mốc đèn bật (nhịp 550 ms) và mốc chạm lại. */
const LIGHT_AT = [500, 1050, 1600] as const;
const TAP_AT = [2650, 3150, 3650] as const;
/** Ba chấm tiến độ dưới biểu tượng pha (130, 170). */
const DOT_XS = [106, 130, 154] as const;

/** Đèn bật: 80 ms mờ vào + phóng 1,1, sáng 300 ms, tắt 100 ms. */
const light = (at: number) =>
  track({ o: 0 })
    .to(at, 80, { s: 1.1, o: 1 })
    .to(at + 380, 100, { s: 1, o: 0 });

/** Chấm tiến độ k: đặc khi đèn k sáng, rỗng khi tới lượt, đặc lại khi chạm đúng ô k. */
const dot = (lit: number, tap: number) =>
  track({ o: 0 })
    .fade(lit, 80, 1, "linear")
    .fade(2150, 100, 0, "linear")
    .fade(tap + 50, 80, 1, "linear");

/** Viền vàng trong ô đã chạm, rồi cả ba nảy 1,15 khi đủ 3 ô. */
const tapped = (tap: number) => track({ o: 0 }).fade(tap, 100).bump(3760, 1.15, 300);

/**
 * Kịch bản Theo dấu ánh đèn (UI-UX 6.11, T = 6.000 ms): ba đèn lần lượt sáng → tới lượt, chạm lại
 * đúng thứ tự → ✓; bước ③ minh hoạ luật Siêu khó bằng số đảo ngược 3 → 2 → 1.
 */
export const LIGHT_TRAIL_SCRIPT = defineScript({
  id: "lt",
  T: 6000,
  steps: [0, 2150, 4300],
  hand: {
    moves: [
      [2150, 450, TRAIL[0]],
      [2800, 300, TRAIL[1]],
      [3300, 300, TRAIL[2]],
      [3900, 400, null],
    ],
    taps: TAP_AT,
  },
  tracks: {
    L0: light(LIGHT_AT[0]),
    L1: light(LIGHT_AT[1]),
    L2: light(LIGHT_AT[2]),
    eye: track().fade(2150, 150, 0),
    ph: track({ s: 0.6, o: 0 }).pop(2150, 150),
    d0: dot(LIGHT_AT[0], TAP_AT[0]),
    d1: dot(LIGHT_AT[1], TAP_AT[1]),
    d2: dot(LIGHT_AT[2], TAP_AT[2]),
    T0: tapped(TAP_AT[0]),
    T1: tapped(TAP_AT[1]),
    T2: tapped(TAP_AT[2]),
    n0: popIn(TAP_AT[0] + 50).fade(4400, 150, 0),
    n1: popIn(TAP_AT[1] + 50).fade(4400, 150, 0),
    n2: popIn(TAP_AT[2] + 50).fade(4400, 150, 0),
    rp0: ripple(TAP_AT[0]),
    rp1: ripple(TAP_AT[1]),
    rp2: ripple(TAP_AT[2]),
    ok: popIn(3820).fade(4400, 150, 0),
    // Số đảo ngược nảy lần lượt từ ô cuối: giữa phải = 1, giữa trên = 2, dưới trái = 3.
    v2: popIn(4450),
    v1: popIn(4510),
    v0: popIn(4570),
    rew: popIn(4300),
    rewt: track({ o: 0 }).fade(4400, 200),
  },
});

/** Ô đèn đang sáng: tia vàng + ô vàng viền giấy. */
function Lamp() {
  return (
    <>
      <path
        d="M-46 0 L-40 0 M46 0 L40 0 M0 -46 L0 -40 M0 46 L0 40 M-33 -33 L-29 -29 M33 -33 L29 -29 M-33 33 L-29 29 M33 33 L29 29"
        fill="none"
        className="stroke-primary"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect
        x={-31}
        y={-31}
        width={62}
        height={62}
        rx={12}
        className="fill-primary stroke-paper"
        strokeWidth={5}
      />
    </>
  );
}

/** Hình minh hoạ động Theo dấu ánh đèn (màn Hướng dẫn); khung tĩnh = `LightTrailHowTo`. */
export function LightTrailDemo(props: DemoProps) {
  return (
    <DemoStage
      script={LIGHT_TRAIL_SCRIPT}
      still={LightTrailHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          <g className="fill-board-shade stroke-chalk/80" strokeWidth={3}>
            {YS.flatMap((y) =>
              XS.map((x) => (
                <rect key={`${x},${y}`} x={x - 30} y={y - 30} width={60} height={60} rx={11} />
              )),
            )}
          </g>
          <g fill="none" className="stroke-chalk" strokeWidth={2.5}>
            {DOT_XS.map((x) => (
              <circle key={x} cx={x} cy={226} r={7} />
            ))}
          </g>
        </g>
      }
    >
      {TRAIL.map(([x, y], i) => (
        <A key={`L${x}`} k={`L${i}`} x={x} y={y}>
          <Lamp />
        </A>
      ))}
      {/* Biểu tượng pha: mắt (xem) → bàn tay phấn (tới lượt) */}
      <A k="eye" x={130} y={170}>
        <g transform="translate(-140 -44)" fill="none" className="stroke-chalk">
          <path
            d="M112 44 C121 29 131 25 140 25 C149 25 159 29 168 44 C159 59 149 63 140 63 C131 63 121 59 112 44 Z"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <circle cx={140} cy={44} r={9} strokeWidth={3.5} />
          <circle cx={140} cy={44} r={4} className="fill-chalk" stroke="none" />
        </g>
      </A>
      <A k="ph" x={130} y={170}>
        <path
          d={HAND_PATH}
          transform="scale(2) translate(-12.3 -12)"
          fill="none"
          className="stroke-chalk"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </A>
      {DOT_XS.map((x, i) => (
        <A key={x} k={`d${i}`} x={x} y={226}>
          <circle r={7} className="fill-chalk" />
        </A>
      ))}
      {TRAIL.map(([x, y], i) => (
        <g key={`T${x}`}>
          <A k={`T${i}`} x={x} y={y}>
            <rect
              x={-24}
              y={-24}
              width={48}
              height={48}
              rx={8}
              className="fill-primary/18 stroke-primary"
              strokeWidth={3}
            />
          </A>
          <NumberBadge k={`n${i}`} x={x - 26} y={y - 26} n={i + 1} />
          <Ripple k={`rp${i}`} x={x} y={y} />
        </g>
      ))}
      <Mark k="ok" x={428} y={160} kind="ok" />
      {TRAIL.map(([x, y], i) => (
        <NumberBadge
          key={`v${x}`}
          k={`v${i}`}
          x={x - 26}
          y={y - 26}
          n={TRAIL.length - i}
          tone="memorize"
        />
      ))}
      {/* Luật Siêu khó: huy hiệu tua ngược + "3 → 2 → 1" */}
      <A k="rew" x={522} y={168}>
        <circle cy={3} r={24} className="fill-ink" />
        <circle r={24} className="fill-memorize stroke-ink" strokeWidth={3} />
        <path d={REWIND_PATH} transform="translate(-1 0) scale(0.66)" className="fill-ink" />
      </A>
      <A k="rewt" x={522} y={228}>
        <text textAnchor="middle" fontSize={24} className="fill-chalk font-display font-extrabold">
          3 → 2 → 1
        </text>
      </A>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
