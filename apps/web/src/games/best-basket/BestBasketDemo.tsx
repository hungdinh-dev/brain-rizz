import type { BestBasketSnack } from "@brain-rizz/shared";
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
import { bagArt, basketBackArt, basketRimArt, CELL } from "./art";
import { BestBasketHowTo, CARD_TOP, Digit, Shapes, Snack, Tag, TotalsRow } from "./BestBasketHowTo";

interface Item {
  kind: BestBasketSnack;
  price: number;
  stars: number;
}

/** Giỏ thu 0,5 từ khung của scene; ba giỏ tâm x 140 · 320 · 500, tâm giỏ y 214 (thẻ y 107–336). */
const S = 0.5;
const BASKET_XS = [140, 320, 500] as const;
const BASKET_Y = 214;
/** Thẻ giỏ trong toạ độ scene (cắt bớt khoảng trống trên quai như hình tĩnh). */
const CARD = { top: CARD_TOP, h: CELL.h / 2 - CARD_TOP } as const;
/** Túi 8 xu giữa phía trên (thẻ 276 × 140 của scene, thu 0,6), tâm (320, 52). */
const BAG = { x: 320, y: 52, k: 0.6, w: 276, h: 140 } as const;
const BUDGET = 8;

/** Như hình tĩnh: giỏ 1 "7 · ★5", giỏ 2 "9 · ★8" (lố 8 xu), giỏ 3 "6 · ★6" (đáp án). */
const BASKETS: readonly [Item, Item][] = [
  [
    { kind: "bun", price: 3, stars: 2 },
    { kind: "milk", price: 4, stars: 3 },
  ],
  [
    { kind: "candy", price: 5, stars: 4 },
    { kind: "juice", price: 4, stars: 4 },
  ],
  [
    { kind: "cookie", price: 1, stars: 2 },
    { kind: "apple", price: 5, stars: 4 },
  ],
];
const OVER = 1;
const ANSWER = 2;
const ANSWER_X = BASKET_XS[ANSWER];
/** Điểm chạm: giữa hai món của giỏ đúng. */
const TAP_AT = [ANSWER_X, BASKET_Y - 34] as const;
const TAP = 3550;
/** Mốc hiện dòng tổng của từng giỏ (bước ②). */
const TOTAL_AT = [1400, 1900, 2400] as const;

/**
 * Kịch bản Giỏ hời nhất (T = 6.000 ms): túi 8 xu nảy + khoanh → dòng tổng từng giỏ hiện lần lượt,
 * giỏ 2 lố tiền (9 > 8) mờ đi, viền nét đứt → chạm giỏ 3 (★6, đủ tiền) → ✓.
 */
export const BEST_BASKET_SCRIPT = defineScript({
  id: "best-basket",
  T: 6000,
  steps: [0, 1200, 3000],
  hand: {
    moves: [
      [3000, 450, TAP_AT],
      [4100, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    bag: track().bump(400, 1.1, 240),
    hBag: popIn(400).fade(1300, 150, 0),
    t0: popIn(TOTAL_AT[0]),
    t1: popIn(TOTAL_AT[1]),
    t2: popIn(TOTAL_AT[2]),
    over: track().fade(TOTAL_AT[1] + 150, 200, 0.5),
    dash: track({ o: 0 }).fade(TOTAL_AT[1] + 150, 200),
    pick: track().bump(TAP + 60, 1.05, 180),
    ring: track({ s: 0.9, o: 0 }).pop(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
  },
});

/** Túi xu (cùng hình với scene), vẽ quanh tâm thẻ. */
function Bag() {
  return (
    <g transform={`scale(${BAG.k}) translate(${-BAG.w / 2} ${-BAG.h / 2})`}>
      <rect y={8} width={BAG.w} height={BAG.h} rx={28} className="fill-sticker" />
      <rect
        width={BAG.w}
        height={BAG.h}
        rx={28}
        strokeWidth={4}
        className="fill-card stroke-card-foreground"
      />
      <g transform="translate(72 72) scale(0.95)">
        <g transform="translate(0 6)">
          <Shapes shapes={bagArt()} mono />
        </g>
        <Shapes shapes={bagArt()} />
      </g>
      <Digit x={198} y={70} size={80} value={BUDGET} />
    </g>
  );
}

/** Thân giỏ (thẻ, giỏ đan, hai món, thẻ giá/sao) trong toạ độ scene. */
function BasketBody({ items }: { items: readonly [Item, Item] }) {
  const { w, r } = CELL;
  return (
    <>
      <rect x={-w / 2} y={CARD.top + 8} width={w} height={CARD.h} rx={r} className="fill-sticker" />
      <rect
        x={-w / 2}
        y={CARD.top}
        width={w}
        height={CARD.h}
        rx={r}
        strokeWidth={5}
        className="fill-card stroke-card-foreground"
      />
      <Shapes shapes={basketBackArt()} />
      {items.map((item, j) => (
        <Snack key={item.kind} kind={item.kind} {...CELL.items[j]!} />
      ))}
      <Shapes shapes={basketRimArt()} />
      {items.map((item, j) => (
        <g key={item.kind}>
          <Tag x={CELL.items[j]!.x} y={CELL.priceY} icon="coin" value={item.price} />
          <Tag x={CELL.items[j]!.x} y={CELL.starY} icon="star" value={item.stars} />
        </g>
      ))}
    </>
  );
}

/** Dòng tổng ở đáy giỏ, nảy quanh tâm dải (toạ độ scene). */
function Totals({ k, items }: { k: string; items: readonly [Item, Item] }) {
  const price = items[0].price + items[1].price;
  const stars = items[0].stars + items[1].stars;
  const cy = CELL.band.y + CELL.band.h / 2;
  return (
    <A k={k} y={cy}>
      <g transform={`translate(0 ${-cy})`}>
        <TotalsRow price={price} stars={stars} ok={price <= BUDGET} />
      </g>
    </A>
  );
}

/** Vòng vàng quanh thẻ giỏ (toạ độ scene), như hình tĩnh. */
function PickRing() {
  const { w, r } = CELL;
  const pad = 8;
  const cy = CARD.top + CARD.h / 2;
  const props = {
    x: -w / 2 - pad,
    y: CARD.top - pad - cy,
    width: w + 2 * pad,
    height: CARD.h + 2 * pad,
    rx: r + pad,
    fill: "none",
  };
  return (
    <A k="ring" y={cy}>
      <rect {...props} strokeWidth={14} className="stroke-sticker" />
      <rect {...props} strokeWidth={8} className="stroke-primary" />
    </A>
  );
}

/** Hình minh hoạ động Giỏ hời nhất (màn Hướng dẫn); khung tĩnh = `BestBasketHowTo`. */
export function BestBasketDemo(props: DemoProps) {
  const cardTopY = BASKET_Y + CARD.top * S;
  return (
    <DemoStage script={BEST_BASKET_SCRIPT} still={BestBasketHowTo} {...props}>
      <A k="bag" x={BAG.x} y={BAG.y}>
        <Bag />
      </A>
      <Ring k="hBag" x={BAG.x} y={BAG.y + 2} rx={98} ry={52} />

      {BASKETS.map((items, i) => {
        const x = BASKET_XS[i] ?? 0;
        const body =
          i === OVER ? (
            <A k="over">
              <BasketBody items={items} />
            </A>
          ) : (
            <BasketBody items={items} />
          );
        return (
          <g key={x} transform={`translate(${x} ${BASKET_Y}) scale(${S})`}>
            {i === ANSWER ? <PickRing /> : null}
            {i === ANSWER ? <A k="pick">{body}</A> : body}
            {i === OVER ? (
              <A k="dash">
                <rect
                  x={-CELL.w / 2}
                  y={CARD.top}
                  width={CELL.w}
                  height={CARD.h}
                  rx={CELL.r}
                  fill="none"
                  strokeWidth={5}
                  strokeDasharray="18 12"
                  strokeOpacity={0.75}
                  className="stroke-card-foreground"
                />
              </A>
            ) : null}
            <Totals k={`t${i}`} items={items} />
          </g>
        );
      })}

      <Mark k="ok" x={ANSWER_X + CELL.w * S * 0.5 - 4} y={cardTopY + 6} kind="ok" />
      <Ripple k="rp" x={TAP_AT[0]} y={TAP_AT[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
