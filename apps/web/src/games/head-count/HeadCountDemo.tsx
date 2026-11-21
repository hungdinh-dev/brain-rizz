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
  type TrackBuilder,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { kidArt } from "./figures";
import { Desk, HeadCountHowTo } from "./HeadCountHowTo";

/** Lớp học 240 × 220 giữa sân khấu (x 200–440, y 20–240); hành lang (mặt đất) y 240. */
const ROOM = { x: 200, y: 20, w: 240, h: 220 } as const;
const FLOOR = ROOM.y + ROOM.h;
/** Cửa giữa chân tường: rộng 44, cao 68. */
const DOOR = { x: 298, y: FLOOR - 68, w: 44, h: 68 } as const;
const DOOR_X = DOOR.x + DOOR.w / 2;
/** Ba bạn ngồi ở bàn lúc đầu (vị trí bàn). */
const SEATED: readonly (readonly [x: number, y: number, look: number])[] = [
  [262, 150, 0],
  [378, 150, 3],
  [320, 212, 1],
];
const KID_SCALE = 0.5;
/** Thẻ số 2 3 4 5 dưới lớp (44 × 56), đáp án 4 = 3 + 2 − 1. */
const CARD = { w: 44, h: 56 } as const;
const CARD_Y = 298;
const CARDS = [
  { n: 2, x: 236 },
  { n: 3, x: 292 },
  { n: 4, x: 348 },
  { n: 5, x: 404 },
] as const;
const ANSWER_X = 348;
const TAP = 4150;

/** Hai bạn vào từ bên trái (quay lưng), một bạn ra bên phải (quay mặt): chỗ đứng, mốc, thời lượng đi. */
const IN_A = { from: 128, at: 1700, dur: 500 } as const;
const IN_B = { from: 66, at: 1850, dur: 550 } as const;
const OUT_C = { to: 510, at: 2650, dur: 500 } as const;

/**
 * Đi bộ từ x hiện tại tới `x` trong `dur` ms: nhún 3 đơn vị mỗi bước 125 ms (linear), tới nơi đứng
 * thẳng. Gốc hình ở giữa hai bàn chân nên nhún = dời lên.
 */
function walk(t: TrackBuilder, at: number, dur: number, fromX: number, toX: number) {
  const steps = Math.max(2, Math.round(dur / 125));
  const step = dur / steps;
  for (let i = 0; i < steps; i++) {
    const x = fromX + ((toX - fromX) * (i + 1)) / steps;
    t.to(at + i * step, step, { x, y: i === steps - 1 || i % 2 === 1 ? 0 : -3 }, "linear");
  }
  return t;
}

/** Bạn đi vào: hiện ở hành lang khi tường vừa hạ, tới cửa rồi khuất vào trong (thu nhỏ + mờ). */
const walkIn = ({ from, at, dur }: { from: number; at: number; dur: number }) =>
  walk(track({ o: 0 }).fade(1550, 150), at, dur, 0, DOOR_X - from).to(at + dur, 150, {
    s: 0.85,
    o: 0,
  });

/**
 * Kịch bản Đếm sĩ số (T = 6.200 ms): lớp có 3 bạn, bảng ghi 3 (khoanh, đếm từng bạn) → tường che
 * lớp, 2 bạn đi vào cửa ("+2"), 1 bạn đi ra ("−1"), cửa đóng → hàng thẻ 2 3 4 5, chạm 4 → ✓.
 */
export const HEAD_COUNT_SCRIPT = defineScript({
  id: "head-count",
  T: 6200,
  steps: [0, 1500, 3500],
  hand: {
    moves: [
      [3600, 450, [ANSWER_X, CARD_Y + 4]],
      [4600, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    board: track().bump(450, 1.15, 240),
    hBoard: popIn(450).fade(1350, 150, 0),
    k0: track().bump(750, 1.15, 180),
    k1: track().bump(950, 1.15, 180),
    k2: track().bump(1150, 1.15, 180),
    wall: track({ y: -FLOOR - 10 }).to(1500, 250, { y: 0 }),
    inA: walkIn(IN_A),
    inB: walkIn(IN_B),
    plus: popIn(2250),
    outC: walk(
      track({ o: 0, s: 0.85 }).to(OUT_C.at, 150, { o: 1, s: 1 }),
      OUT_C.at + 150,
      OUT_C.dur,
      0,
      OUT_C.to - DOOR_X,
    ),
    minus: popIn(2950),
    shut: track({ o: 0 }).fade(3300, 150),
    ...Object.fromEntries(CARDS.map(({ n }, i) => [`c${n}`, popIn(3500 + 60 * i)])),
    pick: track().bump(TAP + 60, 1.15, 160),
    ring: popIn(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
  },
});

/** Lớp học mở: tường giấy, bảng phấn ghi 3, ba bạn ngồi ở bàn (làn `k0`–`k2`). */
function Classroom() {
  return (
    <>
      <rect
        x={ROOM.x}
        y={ROOM.y}
        width={ROOM.w}
        height={ROOM.h}
        rx={14}
        strokeWidth={3}
        className="fill-card stroke-ink"
      />
      <A k="board" x={320} y={56}>
        <rect
          x={-44}
          y={-28}
          width={88}
          height={56}
          rx={6}
          strokeWidth={5}
          className="fill-board stroke-wood"
        />
        <text
          y={15}
          textAnchor="middle"
          fontSize={42}
          className="fill-chalk font-display font-extrabold"
        >
          3
        </text>
      </A>
      {SEATED.map(([x, y, look], i) => (
        <g key={`${x}-${y}`}>
          <A k={`k${i}`} x={x} y={y + 18}>
            <g transform={`scale(${KID_SCALE})`}>{kidArt(look, "front")}</g>
          </A>
          <Desk x={x} y={y} />
        </g>
      ))}
    </>
  );
}

/** Tường che lớp (màu nhóm Tính toán), cửa mở; làn `shut` = lá cửa đóng lại. */
function Wall() {
  return (
    <>
      <rect
        x={ROOM.x}
        y={ROOM.y}
        width={ROOM.w}
        height={ROOM.h}
        rx={14}
        strokeWidth={3}
        className="fill-compute stroke-ink"
      />
      <path
        d={[60, 100, 140, 180].map((y) => `M${ROOM.x} ${y} L${ROOM.x + ROOM.w} ${y}`).join(" ")}
        strokeWidth={2}
        opacity={0.14}
        className="stroke-ink"
      />
      <rect x={DOOR.x} y={DOOR.y} width={DOOR.w} height={DOOR.h} className="fill-ink" />
      <rect
        x={DOOR.x}
        y={DOOR.y}
        width={9}
        height={DOOR.h}
        strokeWidth={2}
        className="fill-wood stroke-ink"
      />
      <A k="shut">
        <rect
          x={DOOR.x}
          y={DOOR.y}
          width={DOOR.w}
          height={DOOR.h}
          strokeWidth={2}
          className="fill-wood stroke-ink"
        />
        <circle
          cx={DOOR.x + DOOR.w - 8}
          cy={DOOR.y + 36}
          r={3.5}
          strokeWidth={1.5}
          className="fill-primary stroke-ink"
        />
      </A>
      <path
        d={`M${DOOR.x} ${FLOOR} L${DOOR.x} ${DOOR.y} L${DOOR.x + DOOR.w} ${DOOR.y} L${DOOR.x + DOOR.w} ${FLOOR}`}
        fill="none"
        strokeWidth={4}
        className="stroke-wood"
      />
    </>
  );
}

/** Chữ "+2" / "−1" viết phấn (ký hiệu và chữ số, không cần dịch). */
function Delta({ k, x, label }: { k: string; x: number; label: string }) {
  return (
    <A k={k} x={x} y={150}>
      <text
        y={12}
        textAnchor="middle"
        fontSize={36}
        className="fill-chalk font-display font-extrabold"
      >
        {label}
      </text>
    </A>
  );
}

/** Thẻ số giấy viền mực có bóng, vẽ quanh tâm. */
function NumberCard({ n }: { n: number }) {
  const props = { x: -CARD.w / 2, width: CARD.w, height: CARD.h, rx: 9 };
  return (
    <>
      <rect {...props} y={-CARD.h / 2 + 4} className="fill-ink" />
      <rect {...props} y={-CARD.h / 2} strokeWidth={3} className="fill-card stroke-ink" />
      <text
        y={12}
        textAnchor="middle"
        fontSize={34}
        className="fill-card-foreground font-display font-extrabold"
      >
        {n}
      </text>
    </>
  );
}

/** Hình minh hoạ động Đếm sĩ số (màn Hướng dẫn); khung tĩnh = `HeadCountHowTo`. */
export function HeadCountDemo(props: DemoProps) {
  return (
    <DemoStage
      script={HEAD_COUNT_SCRIPT}
      still={HeadCountHowTo}
      {...props}
      backdrop={
        <path
          d={`M60 ${FLOOR} L580 ${FLOOR}`}
          strokeWidth={3}
          strokeOpacity={0.35}
          strokeLinecap="round"
          className="stroke-chalk filter-[url(#chalk)]"
        />
      }
    >
      <Classroom />
      <Ring k="hBoard" x={320} y={56} rx={62} ry={42} />
      <A k="wall">
        <Wall />
      </A>

      {/* Hai bạn quay lưng đi vào, một bạn quay mặt đi ra */}
      <A k="inA" x={IN_A.from} y={FLOOR}>
        <g transform={`scale(${KID_SCALE})`}>{kidArt(4, "back")}</g>
      </A>
      <A k="inB" x={IN_B.from} y={FLOOR}>
        <g transform={`scale(${KID_SCALE})`}>{kidArt(2, "back")}</g>
      </A>
      <A k="outC" x={DOOR_X} y={FLOOR}>
        <g transform={`scale(${KID_SCALE})`}>{kidArt(5, "front")}</g>
      </A>
      <Delta k="plus" x={130} label="+2" />
      <Delta k="minus" x={510} label="−1" />

      {/* Hàng thẻ số, chạm 4 */}
      {CARDS.map(({ n, x }) => (
        <A key={n} k={`c${n}`} x={x} y={CARD_Y}>
          {n === 4 ? (
            <A k="pick">
              <NumberCard n={n} />
            </A>
          ) : (
            <NumberCard n={n} />
          )}
        </A>
      ))}
      <Ring k="ring" x={ANSWER_X} y={CARD_Y + 2} rx={34} ry={42} />
      <Mark k="ok" x={ANSWER_X + 30} y={CARD_Y - 34} kind="ok" />
      <Ripple k="rp" x={ANSWER_X} y={CARD_Y} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
