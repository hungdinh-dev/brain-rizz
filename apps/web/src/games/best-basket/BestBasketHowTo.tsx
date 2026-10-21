import type { BestBasketSnack } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import {
  bagArt,
  basketBackArt,
  basketRimArt,
  CELL,
  coinArt,
  type Pt,
  type Shape,
  snackArt,
  starArt,
} from "./art";

/** Giỏ trong hình thu nhỏ từ khung 328 × 488 của scene. */
const S = 0.5;
/** Tâm ba giỏ (x) và hàng giỏ (y), theo artboard 560×360. */
const BASKET_X = [90, 280, 470] as const;
const BASKET_Y = 227;
/** Mép trên thẻ giỏ trong hình (toạ độ giỏ của scene: quai cao tới y ≈ −199). */
const CARD_TOP = -214;
/** Túi xu ở góc trái trên (thẻ 276 × 140 của scene, thu 0,6). */
const BAG = { x: 8, y: 12, k: 0.6 };

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const r1 = (n: number) => Math.round(n * 10) / 10;

function pathOf(pts: readonly Pt[], close: boolean) {
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${r1(p.x)} ${r1(p.y)}`).join("");
  return close ? `${d}Z` : d;
}

/** Vẽ hình của `art.ts` (cùng hình với scene). `mono` = bóng phẳng màu mực nhãn dán. */
function Shapes({ shapes, mono = false }: { shapes: readonly Shape[]; mono?: boolean }) {
  return (
    <>
      {shapes.map((shape) => {
        const d = pathOf(shape.pts, shape.kind === "fill");
        if (shape.kind === "fill") {
          return (
            <path
              key={`f${shape.color}${d}`}
              d={d}
              fill={mono ? undefined : hex(shape.color)}
              fillOpacity={mono ? undefined : shape.alpha}
              strokeWidth={shape.outline}
              strokeLinejoin="round"
              className={cn(mono && "fill-sticker", shape.outline && "stroke-sticker")}
            />
          );
        }
        return (
          <g key={`l${shape.color}${d}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {shape.outline ? (
              <path
                d={d}
                strokeWidth={shape.width + 2 * shape.outline}
                className="stroke-sticker"
              />
            ) : null}
            <path
              d={d}
              strokeWidth={shape.width}
              stroke={mono ? undefined : hex(shape.color)}
              className={mono ? "stroke-sticker" : undefined}
            />
          </g>
        );
      })}
    </>
  );
}

/** Món ăn vặt có bóng phẳng phía dưới, tâm (x, y), phóng `k`. */
function Snack({ kind, x, y, k = 1 }: { kind: BestBasketSnack; x: number; y: number; k?: number }) {
  const art = snackArt(kind);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <g transform="translate(0 6)">
        <Shapes shapes={art} mono />
      </g>
      <Shapes shapes={art} />
    </g>
  );
}

/** Chữ số Baloo 2, `y` là tâm chữ số. */
function Digit({ x, y, size, value }: { x: number; y: number; size: number; value: number }) {
  return (
    <text
      x={x}
      y={y + size * 0.35}
      textAnchor="middle"
      fontSize={size}
      className="fill-card-foreground font-display font-extrabold"
    >
      {value}
    </text>
  );
}

/** Thẻ giá / thẻ sao dưới món (toạ độ trong giỏ). */
function Tag({
  x,
  y,
  icon,
  value,
}: {
  x: number;
  y: number;
  icon: "coin" | "star";
  value: number;
}) {
  const { w, h, font } = CELL.tag;
  const iconR = CELL.tag.icon;
  const left = x - w / 2;
  const iconX = left + h / 4 + iconR;
  return (
    <g>
      <rect x={left} y={y - h / 2 + 4} width={w} height={h} rx={h / 2} className="fill-sticker" />
      <rect
        x={left}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        strokeWidth={3.5}
        className="fill-card stroke-card-foreground"
      />
      <g transform={`translate(${iconX} ${y})`}>
        <Shapes shapes={icon === "coin" ? coinArt(iconR) : starArt(iconR)} />
      </g>
      <Digit x={(iconX + iconR + left + w) / 2} y={y} size={font} value={value} />
    </g>
  );
}

/** Huy hiệu ✓ (vàng) / ✗ (báo lỗi) bán kính `r` quanh (x, y). */
function Mark({ x, y, r, ok }: { x: number; y: number; r: number; ok: boolean }) {
  const k = r / 28;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle cy={5} r={28} className="fill-sticker" />
      <circle
        r={28}
        strokeWidth={4}
        className={ok ? "fill-primary stroke-sticker" : "fill-destructive stroke-sticker"}
      />
      <path
        d={ok ? "M-13 1 L-3 11 L14 -10" : "M-11 -11 L11 11 M11 -11 L-11 11"}
        fill="none"
        strokeWidth={ok ? 6.5 : 7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={ok ? "stroke-primary-foreground" : "stroke-white"}
      />
    </g>
  );
}

interface Item {
  kind: BestBasketSnack;
  price: number;
  stars: number;
}

/**
 * Dòng tổng "🪙7 ✓ · ★5" ở đáy giỏ, căn giữa (bề rộng chữ số ước theo Baloo 2 ≈ 0,55 cỡ chữ).
 * Giỏ lố tiền: số giá gạch đỏ, ✗.
 */
function TotalsRow({ price, stars, ok }: { price: number; stars: number; ok: boolean }) {
  const size = 38;
  const r = 15;
  const digit = size * 0.55;
  const widths = [2 * r, digit, 2 * (r + 1), size * 0.34, 2 * r, digit];
  const gap = 5;
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  const xs: number[] = [];
  let x = -total / 2;
  for (const w of widths) {
    xs.push(x + w / 2);
    x += w + gap;
  }
  const at = (i: number) => xs[i] ?? 0;
  const y = CELL.rowSoloY;
  const { band } = CELL;
  return (
    <g>
      <rect
        x={band.x}
        y={band.y}
        width={band.w}
        height={band.h}
        rx={18}
        strokeWidth={3}
        strokeOpacity={0.35}
        className="fill-card stroke-card-foreground"
      />
      <g transform={`translate(${at(0)} ${y})`}>
        <Shapes shapes={coinArt(r)} />
      </g>
      <Digit x={at(1)} y={y} size={size} value={price} />
      {ok ? null : (
        <path
          d={`M${at(1) - digit / 2 - 2} ${y + 8} L${at(1) + digit / 2 + 2} ${y - 8}`}
          strokeWidth={4.5}
          strokeLinecap="round"
          className="stroke-destructive"
        />
      )}
      <Mark x={at(2)} y={y} r={r + 1} ok={ok} />
      <circle cx={at(3)} cy={y} r={size * 0.08} className="fill-card-foreground" />
      <g transform={`translate(${at(4)} ${y})`}>
        <Shapes shapes={starArt(r)} />
      </g>
      <Digit x={at(5)} y={y} size={size} value={stars} />
    </g>
  );
}

/**
 * Một giỏ đan 2 món trong toạ độ của scene (quanh tâm giỏ), thu `S`. `over`: giỏ lố tiền mờ đi, viền
 * nét đứt; `right`: vòng vàng (giỏ được chạm).
 */
function Basket(props: { x: number; items: [Item, Item]; state: "plain" | "over" | "right" }) {
  const { x, items, state } = props;
  const { w, r } = CELL;
  // Cắt bớt khoảng trống phía trên quai giỏ cho hình to hơn ở thẻ game.
  const top = CARD_TOP;
  const h = CELL.h / 2 - CARD_TOP;
  const price = items[0].price + items[1].price;
  const stars = items[0].stars + items[1].stars;
  const pad = 8;
  return (
    <g transform={`translate(${x} ${BASKET_Y}) scale(${S})`}>
      {state === "right" ? (
        <g fill="none">
          <rect
            x={-w / 2 - pad}
            y={top - pad}
            width={w + 2 * pad}
            height={h + 2 * pad}
            rx={r + pad}
            strokeWidth={14}
            className="stroke-sticker"
          />
          <rect
            x={-w / 2 - pad}
            y={top - pad}
            width={w + 2 * pad}
            height={h + 2 * pad}
            rx={r + pad}
            strokeWidth={8}
            className="stroke-primary"
          />
        </g>
      ) : null}
      <g opacity={state === "over" ? 0.5 : undefined}>
        <rect x={-w / 2} y={top + 8} width={w} height={h} rx={r} className="fill-sticker" />
        <rect
          x={-w / 2}
          y={top}
          width={w}
          height={h}
          rx={r}
          strokeWidth={state === "over" ? 0 : 5}
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
      </g>
      {state === "over" ? (
        <rect
          x={-w / 2}
          y={top}
          width={w}
          height={h}
          rx={r}
          fill="none"
          strokeWidth={5}
          strokeDasharray="18 12"
          strokeOpacity={0.75}
          className="stroke-card-foreground"
        />
      ) : null}
      <TotalsRow price={price} stars={stars} ok={state !== "over"} />
    </g>
  );
}

/** Số thứ tự khoanh phấn. */
function Order({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g className="filter-[url(#chalk)]">
      <circle cx={x} cy={y} r={13} strokeWidth={2.5} className="fill-board stroke-chalk" />
      <text
        x={x}
        y={y + 6}
        textAnchor="middle"
        fontSize={18}
        className="fill-chalk font-display font-extrabold"
      >
        {n}
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Giỏ hời nhất (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: túi
 * xu ghi 8 ở góc trái trên; ba giỏ 2 món. Giỏ 1 (bánh mì 3★2, hộp sữa 4★3) "7 ✓ · ★5"; giỏ 2 (kẹo
 * mút 5★4, nước cam 4★4) "9 ✗ · ★8", số 9 gạch, giỏ mờ; giỏ 3 (bánh quy 1★2, táo 5★4) "6 ✓ · ★6",
 * viền vàng và ngón tay chạm. Số phấn: ① túi xu, ② dấu ✗ của giỏ 2, ③ ngón tay. Đặt trên nền bảng.
 */
export function BestBasketHowTo({ className }: { className?: string }) {
  const bagW = 276;
  const bagH = 140;
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Túi xu */}
      <g transform={`translate(${BAG.x} ${BAG.y}) scale(${BAG.k})`}>
        <rect y={8} width={bagW} height={bagH} rx={28} className="fill-sticker" />
        <rect
          width={bagW}
          height={bagH}
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
        <Digit x={198} y={70} size={80} value={8} />
      </g>

      <Basket
        x={BASKET_X[0]}
        state="plain"
        items={[
          { kind: "bun", price: 3, stars: 2 },
          { kind: "milk", price: 4, stars: 3 },
        ]}
      />
      <Basket
        x={BASKET_X[1]}
        state="over"
        items={[
          { kind: "candy", price: 5, stars: 4 },
          { kind: "juice", price: 4, stars: 4 },
        ]}
      />
      <Basket
        x={BASKET_X[2]}
        state="right"
        items={[
          { kind: "cookie", price: 1, stars: 2 },
          { kind: "apple", price: 5, stars: 4 },
        ]}
      />

      {/* Ngón tay chạm giỏ 3 */}
      <path
        transform="translate(434 172) scale(2.2) translate(-11 -3.5)"
        d="M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z"
        className="fill-board stroke-chalk filter-[url(#chalk)]"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <Order n={1} x={194} y={40} />
      <Order n={2} x={185} y={322} />
      <Order n={3} x={375} y={186} />
    </svg>
  );
}
