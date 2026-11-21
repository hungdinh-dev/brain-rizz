import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Lưới 3 × 3, ô 68 px, tâm ngang 280; hàng trên cùng ở y 44. */
const CELL = 68;
const GRID = { x: 178, y: 10 } as const;
const ROW = GRID.y + CELL / 2;
/** Ô trống (cột 3, hàng trên). */
const GAP = { x: GRID.x + 2 * CELL, y: GRID.y } as const;
const GRID_RIGHT = GRID.x + 3 * CELL;

/** Thẻ: 96 × 86 dưới lưới; mảnh trên thẻ ô 52 px. */
export const CARD = { y: 244, w: 96, h: 86, r: 14 } as const;
const CARD_XS = [168, 280, 392] as const;
const PIECE = 26;
/** Mảnh dây trên thẻ (tâm 0,0, nửa cạnh 26): khúc cua ┐, khúc cua └, dây thẳng ─. */
const CARD_PIECES = [
  `M-${PIECE} 0 L-12 0 A12 12 0 0 1 0 12 L0 ${PIECE}`,
  `M0 -${PIECE} L0 -12 A12 12 0 0 0 12 0 L${PIECE} 0`,
  `M-${PIECE} 0 L${PIECE} 0`,
] as const;

export const QUESTION = "M-9 -9 C-9 -21 10 -21 10 -10 C10 -2 0 -1 0 7";
const TICK = "M-12 1 L-3 10 L13 -9";
/** Mũi tên phấn cong từ thẻ dây thẳng lên ô trống. */
const GUIDE = "M410 232 C448 180 440 112 372 84";
const GUIDE_HEAD = "M382 97 L372 84 L388 82";

/** Pin (gốc = điểm nối, trục +x hướng ra ngoài lưới), cùng hình với scene. */
export function Battery({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.9) rotate(180)`} className={CHALK}>
      <path d="M0 0 L13 0" strokeWidth={14} className="stroke-chalk" />
      <rect x={12} y={-8} width={8} height={16} rx={2} className="fill-chalk" />
      <rect
        x={20}
        y={-17}
        width={38}
        height={34}
        rx={7}
        fill="none"
        strokeWidth={5}
        className="stroke-chalk"
      />
      <path
        d="M25 0 L37 0 M31 -6 L31 6 M42 0 L54 0"
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        className="stroke-chalk"
      />
    </g>
  );
}

/** Bóng đèn đang sáng: bóng vàng, dây tóc mực, tia sáng (trục +x hướng ra ngoài lưới). */
function Bulb({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.9)`} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={35} cy={0} r={28} className="fill-primary" fillOpacity={0.22} />
      <path d="M0 0 L11 0" strokeWidth={14} strokeLinecap="butt" className="stroke-primary" />
      <g className={CHALK}>
        <rect
          x={10}
          y={-11}
          width={12}
          height={22}
          rx={3}
          fill="none"
          strokeWidth={4}
          className="stroke-chalk"
        />
        <path d="M14 -11 L14 11 M18 -11 L18 11" strokeWidth={2.5} className="stroke-chalk" />
      </g>
      <circle cx={35} cy={0} r={15} strokeWidth={4} className="fill-primary stroke-primary" />
      <path
        d="M23 -5 L31 -5 Q38 -5 38 0 Q38 5 31 5 L23 5"
        fill="none"
        strokeWidth={2.5}
        className="stroke-ink"
      />
      <path
        d="M41.5 -17.9 L43.2 -22.6 M50.6 -10.9 L54.7 -13.8 M54 0 L59 0 M50.6 10.9 L54.7 13.8 M41.5 17.9 L43.2 22.6"
        fill="none"
        strokeWidth={4}
        className="stroke-primary"
      />
    </g>
  );
}

/** Thẻ mảnh dây: giấy viền mực có bóng, khung ô mờ, nét dây mực. */
export function Card({ x, piece }: { x: number; piece: string }) {
  const left = x - CARD.w / 2;
  return (
    <g>
      <rect
        x={left}
        y={CARD.y + 6}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        className="fill-sticker"
      />
      <rect
        x={left}
        y={CARD.y}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        strokeWidth={3.5}
        className="fill-card stroke-sticker"
      />
      <g transform={`translate(${x} ${CARD.y + CARD.h / 2})`}>
        <rect
          x={-PIECE}
          y={-PIECE}
          width={2 * PIECE}
          height={2 * PIECE}
          rx={6}
          fill="none"
          strokeWidth={2}
          strokeOpacity={0.18}
          className="stroke-card-foreground"
        />
        <path
          d={piece}
          fill="none"
          strokeWidth={7}
          strokeLinejoin="round"
          className="stroke-card-foreground"
        />
      </g>
    </g>
  );
}

/**
 * Hình minh hoạ Nối mạch (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: lưới 3 × 3
 * phấn, pin ở mép trái hàng trên, hai mảnh dây thẳng ngang, ô thứ ba trống viền nét đứt có dấu "?",
 * bóng đèn sáng ở mép phải ô trống. Dưới lưới ba thẻ: khúc cua, khúc cua, dây thẳng; thẻ dây thẳng
 * được khoanh phấn vàng kèm ✓, mũi tên phấn cong từ thẻ lên ô trống. Không có chữ. Đặt trên nền bảng.
 */
export function CircuitLinkHowTo({ className }: { className?: string }) {
  const cells = Array.from({ length: 9 }, (_, i) => ({
    x: GRID.x + (i % 3) * CELL,
    y: GRID.y + Math.floor(i / 3) * CELL,
    i,
  }));
  return (
    <svg viewBox="112 2 352 346" aria-hidden className={cn("overflow-visible", className)}>
      {/* Lưới: khung ô mờ, chấm phấn ở ô không có dây */}
      <g className="stroke-chalk fill-chalk">
        {cells.map(({ x, y, i }) => (
          <g key={i}>
            <rect
              x={x + 3}
              y={y + 3}
              width={CELL - 6}
              height={CELL - 6}
              rx={8}
              fill="none"
              strokeWidth={2}
              strokeOpacity={0.16}
            />
            {i >= 3 && (
              <circle cx={x + CELL / 2} cy={y + CELL / 2} r={3} stroke="none" fillOpacity={0.35} />
            )}
          </g>
        ))}
      </g>

      {/* Hai mảnh dây thẳng từ pin, dừng ở mép ô trống bằng đầu hở */}
      <g className={cn(CHALK, "stroke-chalk fill-chalk")}>
        <path d={`M${GRID.x} ${ROW} L${GAP.x - 7} ${ROW}`} strokeWidth={18} strokeOpacity={0.15} />
        <path d={`M${GRID.x} ${ROW} L${GAP.x - 7} ${ROW}`} strokeWidth={10} />
        <circle cx={GAP.x - 7} cy={ROW} r={7} stroke="none" />
      </g>
      <Battery x={GRID.x} y={ROW} />

      {/* Ô trống: viền nét đứt vàng + dấu "?" */}
      <rect
        x={GAP.x + 5}
        y={GAP.y + 5}
        width={CELL - 10}
        height={CELL - 10}
        rx={10}
        fill="none"
        strokeWidth={3.5}
        strokeDasharray="9 7"
        strokeOpacity={0.85}
        className={cn(CHALK, "stroke-primary")}
      />
      <g
        transform={`translate(${GAP.x + CELL / 2} ${ROW})`}
        className={cn(CHALK, "stroke-primary fill-primary")}
      >
        <path d={QUESTION} fill="none" strokeWidth={5} strokeLinecap="round" />
        <circle cx={0} cy={16} r={3.4} stroke="none" />
      </g>
      <Bulb x={GRID_RIGHT} y={ROW} />

      {/* Ba thẻ; thẻ dây thẳng được khoanh phấn vàng + ✓ */}
      {CARD_XS.map((x, i) => (
        <Card key={x} x={x} piece={CARD_PIECES[i] ?? ""} />
      ))}
      <rect
        x={CARD_XS[2] - CARD.w / 2 - 8}
        y={CARD.y - 8}
        width={CARD.w + 16}
        height={CARD.h + 20}
        rx={CARD.r + 8}
        fill="none"
        strokeWidth={5}
        className={cn(CHALK, "stroke-primary")}
      />
      <g transform={`translate(${CARD_XS[2] + CARD.w / 2 - 2} ${CARD.y + 2}) scale(0.6)`}>
        <circle cy={5} r={26} className="fill-ink" />
        <circle r={26} strokeWidth={4} className="fill-primary stroke-ink" />
        <path
          d={TICK}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </g>

      {/* Mũi tên phấn cong từ thẻ lên ô trống */}
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(CHALK, "stroke-chalk")}
      >
        <path d={GUIDE} strokeWidth={5} />
        <path d={GUIDE_HEAD} strokeWidth={5} />
      </g>
    </svg>
  );
}
