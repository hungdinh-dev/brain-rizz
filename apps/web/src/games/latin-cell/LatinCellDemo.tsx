import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  flyIn,
  Mark,
  popIn,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { LatinCellHowTo, Shape } from "./LatinCellHowTo";

/** Lưới 4 × 4 ô 54 (x 198–414, y 16–232), như hình tĩnh dời phải 26; hình bán kính 30 % ô. */
const CELL = 54;
const LEFT = 198;
const TOP = 16;
const SIZE = 4;
const SIDE = CELL * SIZE;
const SHAPE_R = CELL * 0.3;

/** Ví dụ Thường của đặc tả: ● 0, ▲ 1, ■ 2, ★ 3; ô ? ở hàng 2, cột 2 (đáp án ★). */
const GIVEN: readonly { cell: number; shape: number }[] = [
  { cell: 1, shape: 1 },
  { cell: 4, shape: 0 },
  { cell: 8, shape: 3 },
  { cell: 13, shape: 2 },
  { cell: 15, shape: 0 },
];
const TARGET = 5;
/** Hình loại khỏi ô ?: ● (cùng hàng), ▲ và ■ (cùng cột), mỗi hình một mốc ở bước ②. */
const RULED_OUT: readonly { cell: number; shape: number; at: number }[] = [
  { cell: 4, shape: 0, at: 1600 },
  { cell: 1, shape: 1, at: 2000 },
  { cell: 13, shape: 2, at: 2400 },
];

/** Hàng thẻ 66 × 62 cách 18 (thẻ thứ i = hình i), đỉnh y 252. */
const CARD = { w: 66, h: 62, top: 252, shadow: 4, r: 10 } as const;
const CARD_XS = [180, 264, 348, 432] as const;
const CARD_Y = CARD.top + CARD.h / 2;
const CARD_R = CARD.h * 0.3;
const ANSWER = 3;
const ANSWER_X = CARD_XS[ANSWER];
const TAP = 3450;

const at = (cell: number) => ({
  x: LEFT + ((cell % SIZE) + 0.5) * CELL,
  y: TOP + (Math.floor(cell / SIZE) + 0.5) * CELL,
});
const target = at(TARGET);

/**
 * Kịch bản Ô bí ẩn (T = 5.400 ms): tô hàng rồi cột của ô ? → loại dần ● (hàng có), ▲ và ■ (cột có):
 * hình trên lưới nhịp, thẻ tương ứng mờ đi → chạm thẻ ★ còn lại → ✓, ★ bay vào ô ?.
 */
export const LATIN_CELL_SCRIPT = defineScript({
  id: "latin-cell",
  T: 5400,
  steps: [0, 1500, 2900],
  hand: {
    moves: [
      [2900, 450, [ANSWER_X, CARD_Y + 2]],
      [4000, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    row: track({ o: 0 })
      .fade(400, 200)
      .fade(TAP + 250, 200, 0),
    col: track({ o: 0 })
      .fade(800, 200)
      .fade(TAP + 250, 200, 0),
    q: track()
      .bump(1150, 1.25, 240)
      .fade(TAP + 250, 120, 0),
    ...Object.fromEntries(
      RULED_OUT.flatMap(({ shape, at: ms }) => [
        [`g${shape}`, track().bump(ms, 1.3, 200)],
        [`c${shape}`, track().fade(ms + 100, 200, 0.3)],
      ]),
    ),
    pick: track().bump(TAP + 60, 1.12, 160),
    ring: popIn(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
    fly: flyIn(TAP + 100, { x: ANSWER_X - target.x, y: CARD_Y - target.y, s: CARD_R / SHAPE_R }),
  },
});

/** Lưới phấn tĩnh: nền sẫm, ô mảnh mờ, viền ngoài đậm. */
function Grid() {
  const lines = [1, 2, 3];
  return (
    <>
      <rect x={LEFT} y={TOP} width={SIDE} height={SIDE} className="fill-board-shade" />
      <g className="stroke-chalk filter-[url(#chalk)]" strokeOpacity={0.45} strokeWidth={1.5}>
        {lines.map((k) => (
          <line key={`v${k}`} x1={LEFT + k * CELL} y1={TOP} x2={LEFT + k * CELL} y2={TOP + SIDE} />
        ))}
        {lines.map((k) => (
          <line key={`h${k}`} x1={LEFT} y1={TOP + k * CELL} x2={LEFT + SIDE} y2={TOP + k * CELL} />
        ))}
      </g>
      <rect
        x={LEFT}
        y={TOP}
        width={SIDE}
        height={SIDE}
        fill="none"
        strokeWidth={3.5}
        className="stroke-chalk filter-[url(#chalk)]"
      />
    </>
  );
}

/** Thẻ hình giấy viền mực có bóng, vẽ quanh tâm. */
function CardFace({ shape }: { shape: number }) {
  return (
    <>
      <rect
        x={-CARD.w / 2}
        y={-CARD.h / 2 + CARD.shadow}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        className="fill-sticker"
      />
      <rect
        x={-CARD.w / 2}
        y={-CARD.h / 2}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        strokeWidth={3}
        className="fill-card stroke-sticker"
      />
      <Shape shape={shape} x={0} y={0} r={CARD_R} />
    </>
  );
}

/** Hình minh hoạ động Ô bí ẩn (màn Hướng dẫn); khung tĩnh = `LatinCellHowTo`. */
export function LatinCellDemo(props: DemoProps) {
  const ruled = new Set(RULED_OUT.map(({ cell }) => cell));
  return (
    <DemoStage script={LATIN_CELL_SCRIPT} still={LatinCellHowTo} {...props} backdrop={<Grid />}>
      {/* Hàng và cột của ô ? (phấn nhạt) */}
      <A k="row">
        <rect
          x={LEFT}
          y={target.y - CELL / 2}
          width={SIDE}
          height={CELL}
          className="fill-chalk"
          fillOpacity={0.13}
        />
      </A>
      <A k="col">
        <rect
          x={target.x - CELL / 2}
          y={TOP}
          width={CELL}
          height={SIDE}
          className="fill-chalk"
          fillOpacity={0.13}
        />
      </A>

      {GIVEN.map(({ cell, shape }) =>
        ruled.has(cell) ? (
          <A key={cell} k={`g${shape}`} x={at(cell).x} y={at(cell).y}>
            <Shape shape={shape} x={0} y={0} r={SHAPE_R} />
          </A>
        ) : (
          <Shape key={cell} shape={shape} x={at(cell).x} y={at(cell).y} r={SHAPE_R} />
        ),
      )}

      {/* Ô ?: viền vàng, dấu ? */}
      <rect
        x={target.x - CELL / 2 + 5}
        y={target.y - CELL / 2 + 5}
        width={CELL - 10}
        height={CELL - 10}
        rx={6}
        fill="none"
        strokeWidth={3}
        className="stroke-primary"
      />
      <A k="q" x={target.x} y={target.y}>
        <text
          y={12}
          textAnchor="middle"
          fontSize={34}
          className="fill-chalk font-display font-extrabold"
        >
          ?
        </text>
      </A>

      {/* Hàng thẻ: ● ▲ ■ mờ dần khi bị loại, ★ được chạm */}
      {CARD_XS.map((x, shape) => (
        <A key={x} k={shape === ANSWER ? "pick" : `c${shape}`} x={x} y={CARD_Y}>
          <CardFace shape={shape} />
        </A>
      ))}
      <Ring k="ring" x={ANSWER_X} y={CARD_Y + 2} rx={44} ry={42} />
      <Mark k="ok" x={ANSWER_X + 36} y={CARD.top - 4} kind="ok" />

      {/* ★ bay vào ô ? */}
      <A k="fly" x={target.x} y={target.y}>
        <Shape shape={ANSWER} x={0} y={0} r={SHAPE_R} />
      </A>
      <Ripple k="rp" x={ANSWER_X} y={CARD_Y} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
