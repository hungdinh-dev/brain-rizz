import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  RectRing,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { L_MIRRORED, L_SHAPE, ModelCard, TopViewHowTo, ViewCard } from "./TopViewHowTo";

type Point = readonly [x: number, y: number];

/** Thẻ mô hình của hình minh hoạ dời sang phải 40 để nằm giữa sân khấu (tâm x 320). */
const MODEL_DX = 40;
/** Ba thẻ hình chiếu 130 × 130 (góc trái), hàng y 200–330: xoay sai · đúng · lật gương. */
const CARD_XS = [100, 255, 410] as const;
const ROTATED = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
] as const;
const CARDS = [ROTATED, L_SHAPE, L_MIRRORED] as const;
const PICK: Point = [320, 265];
/** Giữa mép cam (trước–trái) của bệ trên thẻ mô hình; mép nghiêng 30°. */
const EDGE: Point = [295, 135];
/** Tâm vạch cam dưới lưới của thẻ có góc trái `x`. */
const stripAt = (x: number): Point => [x + 65, 303.5];

/**
 * Kịch bản Nhìn từ trên (CR-021, T = 4.800 ms): nhìn mô hình chữ L → khoanh mép cam của bệ, vạch
 * cam dưới ba lưới nảy theo (phía trước nằm dưới) → chạm thẻ chữ L đúng → ✓.
 */
export const TOP_VIEW_SCRIPT = defineScript({
  id: "tpv",
  T: 4800,
  steps: [0, 1000, 2300],
  hand: {
    moves: [
      [2150, 450, PICK],
      [3200, 400, null],
    ],
    taps: [2700],
  },
  tracks: {
    model: track().to(400, 200, { s: 1.05 }, "glide").to(600, 200, { s: 1 }, "glide"),
    edge: popIn(1050).fade(2300, 150, 0),
    ...Object.fromEntries(
      CARD_XS.map((_, i) => [
        `e${i}`,
        track({ o: 0 })
          .fade(1250 + i * 80, 120)
          .bump(1370 + i * 80, 1.3, 240)
          .fade(2300, 150, 0),
      ]),
    ),
    pick: track().bump(2760, 1.06, 180),
    ring: popIn(2760),
    ok: popIn(2820),
    rp: ripple(2700),
  },
});

/** Hình minh hoạ động Nhìn từ trên (màn Hướng dẫn); khung tĩnh = `TopViewHowTo`. */
export function TopViewDemo(props: DemoProps) {
  return (
    <DemoStage script={TOP_VIEW_SCRIPT} still={TopViewHowTo} {...props}>
      <A k="model" x={280 + MODEL_DX} y={86}>
        <g transform={`translate(${-280} ${-86})`}>
          <ModelCard />
        </g>
      </A>
      <g transform={`translate(${EDGE[0]} ${EDGE[1]}) rotate(30)`}>
        <Ring k="edge" x={0} y={0} rx={40} ry={15} />
      </g>

      {CARDS.map((cells, i) => {
        const x = CARD_XS[i] ?? 0;
        return x + 65 === PICK[0] ? (
          <A key={x} k="pick" x={PICK[0]} y={PICK[1]}>
            <g transform={`translate(${-PICK[0]} ${-PICK[1]})`}>
              <ViewCard x={x} cells={cells} />
            </g>
          </A>
        ) : (
          <ViewCard key={x} x={x} cells={cells} />
        );
      })}

      {/* Vạch cam (phía trước) dưới mỗi lưới nảy lên */}
      {CARD_XS.map((x, i) => {
        const [sx, sy] = stripAt(x);
        return (
          <A key={x} k={`e${i}`} x={sx} y={sy}>
            <rect
              x={-38}
              y={-5}
              width={76}
              height={10}
              rx={3.5}
              className="fill-identify stroke-ink"
              strokeWidth={2.5}
            />
          </A>
        );
      })}

      <RectRing k="ring" x={PICK[0]} y={PICK[1]} w={148} h={148} rx={22} />
      <Mark k="ok" x={PICK[0] + 68} y={PICK[1] - 70} kind="ok" />
      <Ripple k="rp" x={PICK[0]} y={PICK[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
