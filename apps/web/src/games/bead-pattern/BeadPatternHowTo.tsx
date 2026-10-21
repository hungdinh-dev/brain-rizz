import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { beadShapePath, CHECKER_CELLS, PATTERN_ALPHA, STRIPE } from "./beads";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Màu theo hình, cùng bảng với scene: 0 tròn (sky), 1 vuông (mint). */
const SHAPE_FILL = ["fill-sky", "fill-mint"] as const;

/** Cỡ hạt trên chuỗi và trên thẻ. */
const CHAIN_BEAD = 60;
const CARD_BEAD = 56;
/** Chuỗi 6 hạt: tâm y 96, x 60 → 500 (bước 88). */
const CHAIN_Y = 96;
const CHAIN_XS = [60, 148, 236, 324, 412, 500] as const;
/** Thẻ 128 × 84, lưới 2 × 2 giữa khung. */
const CARD = { w: 128, h: 84, r: 14 } as const;

const TICK = "M-12 1 L-3 10 L13 -9";
const QUESTION = "M-8 -9 C-8 -18 8 -18 8 -9 C8 -3 0 -3 0 5";
/** Mũi tên phấn từ thẻ đúng lên chỗ "?" (đi qua khe giữa chuỗi và hàng thẻ). */
const GUIDE = "M240 160 C300 140 410 150 474 132";
const GUIDE_HEAD = "M458 128 L474 132 L464 145";

type Pattern = "stripe" | "checker";

/**
 * Một hạt: thân màu theo hình, hoa văn (sọc / ca-rô) phủ mực mờ cắt theo hình, viền.
 * `edge` = lớp màu viền (phấn trên bảng, chữ thẻ trên thẻ).
 */
function Bead({
  x,
  y,
  shape,
  pattern,
  size,
  ids,
  edge,
}: {
  x: number;
  y: number;
  shape: 0 | 1;
  pattern: Pattern;
  size: number;
  ids: Record<Pattern, string>;
  edge: string;
}) {
  const d = beadShapePath(shape, size);
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={d} className={SHAPE_FILL[shape]} />
      <path d={d} fill={`url(#${ids[pattern]}-${size})`} />
      <path d={d} fill="none" strokeWidth={3.5} strokeLinejoin="round" className={edge} />
    </g>
  );
}

/** Mẫu hoa văn theo cỡ hạt (cùng tỉ lệ với scene). Gốc mẫu = tâm hạt nhờ `userSpaceOnUse`. */
function PatternDefs({ ids, size }: { ids: Record<Pattern, string>; size: number }) {
  const period = size * STRIPE.period;
  const cell = size / CHECKER_CELLS;
  return (
    <>
      <pattern
        id={`${ids.stripe}-${size}`}
        x={(-period * STRIPE.width) / 2}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(-45)"
      >
        <rect
          width={period * STRIPE.width}
          height={period}
          className="fill-ink"
          fillOpacity={PATTERN_ALPHA}
        />
      </pattern>
      <pattern
        id={`${ids.checker}-${size}`}
        x={-cell / 2}
        y={-cell / 2}
        width={cell * 2}
        height={cell * 2}
        patternUnits="userSpaceOnUse"
      >
        <rect width={cell} height={cell} className="fill-ink" fillOpacity={PATTERN_ALPHA} />
        <rect
          x={cell}
          y={cell}
          width={cell}
          height={cell}
          className="fill-ink"
          fillOpacity={PATTERN_ALPHA}
        />
      </pattern>
    </>
  );
}

/** Thẻ giấy có bóng đổ; `right` = viền vàng + dấu ✓, không thì mờ. */
function Card({
  x,
  y,
  right,
  children,
}: {
  x: number;
  y: number;
  right?: boolean;
  children: ReactNode;
}) {
  const left = x - CARD.w / 2;
  const top = y - CARD.h / 2;
  return (
    <g opacity={right ? 1 : 0.45}>
      <rect
        x={left}
        y={top + 5}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        className="fill-sticker"
      />
      <rect
        x={left}
        y={top}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        strokeWidth={3}
        className="fill-card stroke-sticker"
      />
      {right && (
        <>
          <rect
            x={left + 2}
            y={top + 2}
            width={CARD.w - 4}
            height={CARD.h - 4}
            rx={CARD.r - 2}
            fill="none"
            strokeWidth={9}
            className="stroke-sticker"
          />
          <rect
            x={left + 2}
            y={top + 2}
            width={CARD.w - 4}
            height={CARD.h - 4}
            rx={CARD.r - 2}
            fill="none"
            strokeWidth={5}
            className="stroke-primary"
          />
        </>
      )}
      {children}
      {right && (
        <g transform={`translate(${left + CARD.w - 6} ${top + 6}) scale(0.6)`}>
          <circle cy={5} r={26} className="fill-sticker" />
          <circle r={26} strokeWidth={4} className="fill-primary stroke-sticker" />
          <path
            d={TICK}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink"
          />
        </g>
      )}
    </g>
  );
}

/**
 * Hình minh hoạ Chuỗi quy luật (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả:
 * chuỗi 6 hạt trên sợi dây phấn (tròn sọc, vuông sọc, … , tròn sọc) rồi chỗ trống nét đứt có "?".
 * Dưới là 4 thẻ 2 × 2: vuông sọc (viền vàng + ✓, mũi tên phấn chỉ lên "?"), tròn sọc, vuông ca-rô,
 * tròn ca-rô (ba thẻ này mờ). Đặt trên nền bảng.
 */
export function BeadPatternHowTo({ className }: { className?: string }) {
  // Mỗi bản hình có mẫu hoa văn riêng (id duy nhất) để bản đầu bị ẩn không làm mất hoa văn bản sau.
  const base = `bead-pattern-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ids: Record<Pattern, string> = { stripe: `${base}-stripe`, checker: `${base}-checker` };
  return (
    <svg viewBox="8 52 544 306" aria-hidden className={cn("overflow-visible", className)}>
      <defs>
        <PatternDefs ids={ids} size={CHAIN_BEAD} />
        <PatternDefs ids={ids} size={CARD_BEAD} />
      </defs>

      {/* Sợi dây phấn (không dùng filter phấn: nét ngang có khung bao cao 0 nên filter làm mất nét) */}
      <g className="stroke-chalk" strokeLinecap="round">
        <path d={`M22 ${CHAIN_Y} L538 ${CHAIN_Y}`} strokeWidth={10} strokeOpacity={0.18} />
        <path d={`M22 ${CHAIN_Y} L538 ${CHAIN_Y}`} strokeWidth={4} />
      </g>

      {/* Chuỗi: tròn sọc / vuông sọc xen kẽ */}
      {CHAIN_XS.slice(0, 5).map((x, i) => (
        <Bead
          key={x}
          x={x}
          y={CHAIN_Y}
          shape={i % 2 === 0 ? 0 : 1}
          pattern="stripe"
          size={CHAIN_BEAD}
          ids={ids}
          edge="stroke-chalk"
        />
      ))}

      {/* Chỗ trống: vòng nét đứt + "?" */}
      <g
        transform={`translate(${CHAIN_XS[5]} ${CHAIN_Y})`}
        className={cn(CHALK, "stroke-chalk")}
        fill="none"
        strokeLinecap="round"
      >
        <circle r={CHAIN_BEAD / 2 - 2} strokeWidth={4} strokeDasharray="9 7" />
        <path d={QUESTION} strokeWidth={5} />
        <circle cy={14} r={3.4} className="fill-chalk" stroke="none" />
      </g>

      {/* 4 thẻ 2 × 2 */}
      <Card x={208} y={210} right>
        <Bead
          x={208}
          y={210}
          shape={1}
          pattern="stripe"
          size={CARD_BEAD}
          ids={ids}
          edge="stroke-card-foreground"
        />
      </Card>
      <Card x={352} y={210}>
        <Bead
          x={352}
          y={210}
          shape={0}
          pattern="stripe"
          size={CARD_BEAD}
          ids={ids}
          edge="stroke-card-foreground"
        />
      </Card>
      <Card x={208} y={308}>
        <Bead
          x={208}
          y={308}
          shape={1}
          pattern="checker"
          size={CARD_BEAD}
          ids={ids}
          edge="stroke-card-foreground"
        />
      </Card>
      <Card x={352} y={308}>
        <Bead
          x={352}
          y={308}
          shape={0}
          pattern="checker"
          size={CARD_BEAD}
          ids={ids}
          edge="stroke-card-foreground"
        />
      </Card>

      {/* Mũi tên phấn từ thẻ đúng lên chỗ "?" */}
      <g
        className={cn(CHALK, "stroke-chalk")}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={GUIDE} strokeWidth={11} strokeOpacity={0.18} />
        <path d={GUIDE} strokeWidth={4.5} />
        <path d={GUIDE_HEAD} strokeWidth={4.5} />
      </g>
    </svg>
  );
}
