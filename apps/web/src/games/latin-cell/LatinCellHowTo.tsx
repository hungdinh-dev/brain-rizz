import { cn } from "@/lib/utils";
import { HAND_PATH } from "../_shared/icons";
import { SHAPE_PAINTS, SHAPES, svgPoints } from "./shapes";

/** Nét phấn sần: filter SVG #chalk khai báo một lần trong <ChalkDefs /> của App. */
const CHALK = "filter-[url(#chalk)]";

/** Lưới 4×4 ô 54 (x 172–388, y 14–230), hình bán kính 30 % ô như scene. */
const CELL = 54;
const LEFT = 172;
const TOP = 14;
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
/** Hàng và cột của ô ? (tô phấn nhạt). */
const UNITS = [4, 5, 6, 7, 1, 9, 13];

/** Hàng thẻ: 4 thẻ 66 × 62 cách 18, tâm y 287; thẻ ★ (thứ 4) được khoanh phấn. */
const CARD = { w: 66, h: 62, gap: 18, top: 256, shadow: 4, r: 10 };
const CARD_XS = [154, 238, 322, 406];
const CARD_Y = CARD.top + CARD.h / 2;
const ANSWER = 3;

const at = (cell: number) => ({
  x: LEFT + ((cell % SIZE) + 0.5) * CELL,
  y: TOP + (Math.floor(cell / SIZE) + 0.5) * CELL,
});

/** Hình theo bảng hình của game: màu phụ + viền mực (như scene). */
export function Shape({ shape, x, y, r }: { shape: number; x: number; y: number; r: number }) {
  const geom = SHAPES[shape];
  const className = cn(SHAPE_PAINTS[shape]?.className, "stroke-sticker");
  const width = Math.max(2, r * 0.11);
  if (!geom) return null;
  if (geom.kind === "circle") {
    return <circle cx={x} cy={y} r={geom.r * r} strokeWidth={width} className={className} />;
  }
  return (
    <polygon
      points={svgPoints(geom.points, r)}
      transform={`translate(${x} ${y})`}
      strokeWidth={width}
      strokeLinejoin="round"
      className={className}
    />
  );
}

/** Huy hiệu số bước ①②③ (chữ số là ký hiệu, không cần dịch). */
function Badge({ x, y, n, r = 8.5 }: { x: number; y: number; n: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} strokeWidth={2} className="fill-primary stroke-sticker" />
      <text
        x={x}
        y={y + r * 0.45}
        textAnchor="middle"
        fontSize={r * 1.45}
        className="fill-primary-foreground font-display font-extrabold"
      >
        {n}
      </text>
    </g>
  );
}

/** Lưới phấn: nền sẫm, ô mảnh mờ, viền ngoài đậm. */
function Grid() {
  const inner = [1, 2, 3].map((k) => LEFT + k * CELL);
  const innerY = [1, 2, 3].map((k) => TOP + k * CELL);
  return (
    <>
      <rect x={LEFT} y={TOP} width={SIDE} height={SIDE} className="fill-board-shade" />
      <g className="fill-chalk" fillOpacity={0.12}>
        {UNITS.map((cell) => (
          <rect
            key={cell}
            x={at(cell).x - CELL / 2}
            y={at(cell).y - CELL / 2}
            width={CELL}
            height={CELL}
          />
        ))}
      </g>
      <g className={cn(CHALK, "stroke-chalk")} strokeOpacity={0.45} strokeWidth={1.5}>
        {inner.map((x) => (
          <line key={`v${x}`} x1={x} y1={TOP} x2={x} y2={TOP + SIDE} />
        ))}
        {innerY.map((y) => (
          <line key={`h${y}`} x1={LEFT} y1={y} x2={LEFT + SIDE} y2={y} />
        ))}
      </g>
      <rect
        x={LEFT}
        y={TOP}
        width={SIDE}
        height={SIDE}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
    </>
  );
}

/**
 * Hình minh hoạ Ô bí ẩn (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả (chưa có
 * bản mẫu): lưới 4×4 của ví dụ Thường, hàng và cột của ô ? tô phấn nhạt; ① cạnh hình tròn (hàng),
 * ② cạnh tam giác và hình vuông (cột). Hàng 4 thẻ bên dưới, thẻ ngôi sao được khoanh phấn, bàn tay
 * chỉ vào, ③. Đặt trên nền bảng.
 */
export function LatinCellHowTo({ className }: { className?: string }) {
  const target = at(TARGET);
  const inset = 5;
  const answerX = CARD_XS[ANSWER] ?? 0;
  return (
    <svg viewBox="112 6 364 338" aria-hidden className={cn("overflow-visible", className)}>
      <Grid />
      {GIVEN.map(({ cell, shape }) => (
        <Shape key={cell} shape={shape} x={at(cell).x} y={at(cell).y} r={SHAPE_R} />
      ))}

      {/* Ô ?: viền vàng, dấu ? viết phấn */}
      <rect
        x={target.x - CELL / 2 + inset}
        y={target.y - CELL / 2 + inset}
        width={CELL - 2 * inset}
        height={CELL - 2 * inset}
        rx={6}
        fill="none"
        strokeWidth={3}
        className="stroke-primary"
      />
      <text
        x={target.x}
        y={target.y + 12}
        textAnchor="middle"
        fontSize={34}
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
      >
        ?
      </text>

      {/* ① hàng có ●, ② cột có ▲ và ■ */}
      <Badge x={at(4).x + 19} y={at(4).y - 19} n={1} />
      <Badge x={at(1).x + 19} y={at(1).y - 19} n={2} />
      <Badge x={at(13).x + 19} y={at(13).y - 19} n={2} />

      {/* Hàng thẻ */}
      {CARD_XS.map((x, shape) => (
        <g key={x}>
          <rect
            x={x - CARD.w / 2}
            y={CARD.top + CARD.shadow}
            width={CARD.w}
            height={CARD.h}
            rx={CARD.r}
            className="fill-sticker"
          />
          <rect
            x={x - CARD.w / 2}
            y={CARD.top}
            width={CARD.w}
            height={CARD.h}
            rx={CARD.r}
            strokeWidth={3}
            className="fill-card stroke-sticker"
          />
          <Shape shape={shape} x={x} y={CARD_Y} r={CARD.h * 0.3} />
        </g>
      ))}

      {/* Thẻ ★ khoanh phấn, bàn tay chỉ vào, ③ */}
      <rect
        x={answerX - CARD.w / 2 - 7}
        y={CARD.top - 7}
        width={CARD.w + 14}
        height={CARD.h + CARD.shadow + 14}
        rx={16}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
      <path
        d={HAND_PATH}
        transform={`translate(${answerX + 12} 304) scale(2) translate(-11 -3.5)`}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="fill-chalk stroke-ink"
      />
      <Badge x={answerX + 52} y={CARD.top - 2} n={3} r={11} />
    </svg>
  );
}
