import type { BalanceItem } from "@brain-rizz/shared";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  RectRing,
  Ripple,
  ripple,
  StepBadge,
  type TrackBuilder,
  track,
} from "../_shared/demo";
import { EYE_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { ChalkItem, PairFlipHowTo } from "./PairFlipHowTo";

type Point = readonly [x: number, y: number];

/** Bàn 3 × 2, thẻ 72 × 100: tâm cột, tâm hàng. */
const COLS = [230, 320, 410] as const;
const ROWS = [116, 236] as const;
const CARD = { w: 72, h: 100 } as const;
const ITEM_SIZE = 0.54;
/** Hàng trên táo, chuối, cà rốt; hàng dưới cà rốt, táo, chuối (như hình minh hoạ). */
const BOARD: readonly BalanceItem[] = ["apple", "banana", "carrot", "carrot", "apple", "banana"];
const cellAt = (i: number): Point => [COLS[i % 3] ?? 0, ROWS[Math.floor(i / 3)] ?? 0];
/** Thẻ đề (táo, góc trên trái) và thẻ úp giống nó (táo, giữa hàng dưới). */
const CLUE = 0;
const MATCH = 4;
const PICK = cellAt(MATCH);
/** Vạch thời gian xem nhanh dưới bàn: mép trái, rộng. */
const BAR = { x: 194, y: 316, w: 252 } as const;

/** Mốc: hết xem, úp cả bàn, lật thẻ đề, chạm thẻ giống. */
const HIDE_AT = 1300;
const CLUE_AT = 1600;
const TAP_AT = 2900;

/** Lật bằng co ngang: mặt cũ co về 0 trong 100 ms, mặt mới nở từ 0 trong 100 ms. */
const shut = (b: TrackBuilder, at: number) => b.to(at, 100, { sx: 0 }, "linear");
const open = (b: TrackBuilder, at: number) => b.to(at, 100, { sx: 1 }, "linear");

/** Làn mặt ngửa (`F`) và mặt úp (`K`) của từng thẻ. */
function flipTracks(i: number): Record<string, TrackBuilder> {
  const face = shut(track(), HIDE_AT);
  const back = open(track({ sx: 0 }), HIDE_AT + 100);
  if (i === CLUE) {
    shut(back, CLUE_AT);
    open(face, CLUE_AT + 100);
  }
  if (i === MATCH) {
    shut(back, TAP_AT + 60);
    open(face, TAP_AT + 160);
  }
  return { [`F${i}`]: face, [`K${i}`]: back };
}

/**
 * Kịch bản Lật cặp (CR-021, T = 5.000 ms): xem nhanh cả bàn ngửa (vạch thời gian rút ngắn) → úp hết
 * → thẻ đề táo lật lên, vòng vàng → chạm thẻ úp giữa hàng dưới, lật ra táo → vòng vàng + ✓.
 */
export const PAIR_FLIP_SCRIPT = defineScript({
  id: "prf",
  T: 5000,
  steps: [0, 1500, 2400],
  hand: {
    moves: [
      [2350, 450, PICK],
      [3500, 400, null],
    ],
    taps: [TAP_AT],
  },
  tracks: {
    bar: track().to(300, HIDE_AT - 300, { sx: 0 }, "linear"),
    eye: track().fade(HIDE_AT, 150, 0),
    ...Object.fromEntries(BOARD.flatMap((_, i) => Object.entries(flipTracks(i)))),
    clue: popIn(CLUE_AT + 200),
    pick: track().bump(TAP_AT + 260, 1.08, 180),
    ring: popIn(TAP_AT + 260),
    ok: popIn(TAP_AT + 300),
    rp: ripple(TAP_AT),
  },
});

/** Mặt ngửa: khung phấn trong suốt + vật vẽ phấn, tâm 0,0. */
function FaceSide({ item }: { item: BalanceItem }) {
  return (
    <>
      <rect
        x={-CARD.w / 2}
        y={-CARD.h / 2}
        width={CARD.w}
        height={CARD.h}
        rx={12}
        strokeWidth={3}
        className="fill-board-shade stroke-chalk/85"
      />
      <ChalkItem item={item} x={0} y={0} size={ITEM_SIZE} rough={false} />
    </>
  );
}

/** Mặt úp: nền tối, khung trong hồng, dấu "?", tâm 0,0. */
function BackSide() {
  return (
    <>
      <rect
        x={-CARD.w / 2}
        y={-CARD.h / 2}
        width={CARD.w}
        height={CARD.h}
        rx={12}
        strokeWidth={3}
        className="fill-sticker stroke-chalk/80"
      />
      <rect
        x={-CARD.w / 2 + 7}
        y={-CARD.h / 2 + 7}
        width={CARD.w - 14}
        height={CARD.h - 14}
        rx={7}
        strokeWidth={2}
        className="fill-none stroke-pink/75"
      />
      <text
        y={13}
        textAnchor="middle"
        fontSize={38}
        className="fill-chalk/85 font-display font-extrabold"
      >
        ?
      </text>
    </>
  );
}

/** Vòng vàng quanh thẻ: lề 8 quanh thẻ, góc 16. */
const RING = { w: CARD.w + 16, h: CARD.h + 16, rx: 16 } as const;

/** Hình minh hoạ động Lật cặp (màn Hướng dẫn); khung tĩnh = `PairFlipHowTo`. */
export function PairFlipDemo(props: DemoProps) {
  return (
    <DemoStage
      script={PAIR_FLIP_SCRIPT}
      still={PairFlipHowTo}
      {...props}
      backdrop={
        <rect
          x={BAR.x}
          y={BAR.y - 5}
          width={BAR.w}
          height={10}
          rx={5}
          className="fill-chalk/15 filter-[url(#chalk)]"
        />
      }
    >
      {/* Mắt: đang được xem nhanh */}
      <A k="eye" x={110} y={176}>
        <path
          d={EYE_PATH}
          transform="scale(0.6)"
          fill="none"
          className="stroke-chalk"
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <circle r={7} fill="none" className="stroke-chalk" strokeWidth={3} />
        <circle r={3} className="fill-chalk" />
      </A>
      <A k="bar" x={BAR.x} y={BAR.y}>
        <rect y={-5} width={BAR.w} height={10} rx={5} className="fill-primary" />
      </A>

      {BOARD.map((item, i) => {
        const [x, y] = cellAt(i);
        const card = (
          <>
            <A k={`F${i}`}>
              <FaceSide item={item} />
            </A>
            <A k={`K${i}`}>
              <BackSide />
            </A>
          </>
        );
        return i === MATCH ? (
          <A key={`${x},${y}`} k="pick" x={x} y={y}>
            {card}
          </A>
        ) : (
          <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
            {card}
          </g>
        );
      })}

      <RectRing k="clue" x={cellAt(CLUE)[0]} y={cellAt(CLUE)[1]} {...RING} />
      <RectRing k="ring" x={PICK[0]} y={PICK[1]} {...RING} />
      <Mark k="ok" x={PICK[0] + 40} y={PICK[1] - 52} kind="ok" />
      <Ripple k="rp" x={PICK[0]} y={PICK[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
