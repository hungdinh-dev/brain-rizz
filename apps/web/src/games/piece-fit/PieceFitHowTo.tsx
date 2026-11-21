import { cn } from "@/lib/utils";

type Cell = readonly [x: number, y: number];

/** Cạnh một ô (đơn vị viewBox), chung cho hộp và hai thẻ để mảnh lắp vừa khít. */
const CELL = 24;
/** Hộp 5 × 5, góc trên trái. */
const BOX: Cell = [220, 14];
const BOX_SIDE = 5 * CELL;
/** Khoảng trống chữ L (`#.` / `#.` / `##`) ở góc phải dưới hộp: cột 3–4, hàng 2–4. */
const GAP: readonly Cell[] = [
  [3, 2],
  [3, 3],
  [3, 4],
  [4, 4],
];
/** Viền phấn gạch đứt của khoảng trống, lùi vào trong 2,5 để không lấn sang ô đã xếp. */
const GAP_OUTLINE = "M294.5 64.5 H313.5 V112.5 H337.5 V131.5 H294.5 Z";
/** Chữ L xoay 90° (`###` / `#..`): đúng. Góc trên trái từng ô. */
const TURNED: readonly Cell[] = [
  [139, 237],
  [163, 237],
  [187, 237],
  [139, 261],
];
/** Bản lật gương (chữ J) xoay 90° (`#..` / `###`): sai. */
const MIRRORED: readonly Cell[] = [
  [349, 237],
  [349, 261],
  [373, 261],
  [397, 261],
];

/** Gạch chéo "/" phủ cả hộp, cách nhau 8; khoảng trống tô đè lên sau. */
const HATCH = (() => {
  const [left, top] = BOX;
  const parts: string[] = [];
  for (let c = 4; c < 2 * BOX_SIDE; c += 8) {
    const x1 = Math.min(c, BOX_SIDE);
    const y2 = Math.min(c, BOX_SIDE);
    parts.push(`M${left + x1} ${top + c - x1} L${left + c - y2} ${top + y2}`);
  }
  return parts.join(" ");
})();

/** Đường chia ô của hộp (khoảng trống tô đè lên sau). */
const BOX_GRID = (() => {
  const [left, top] = BOX;
  const parts: string[] = [];
  for (let i = 1; i < 5; i++) {
    parts.push(`M${left + i * CELL} ${top} V${top + BOX_SIDE}`);
    parts.push(`M${left} ${top + i * CELL} H${left + BOX_SIDE}`);
  }
  return parts.join(" ");
})();

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Mảnh ghép ô: viền mực ngoài, ô tím nhóm Hình dung, đường chia ô mờ. */
export function Piece({ cells }: { cells: readonly Cell[] }) {
  const rects = cells.map(([x, y]) => (
    <rect key={`${x},${y}`} x={x} y={y} width={CELL} height={CELL} />
  ));
  return (
    <>
      <g className="fill-none stroke-ink" strokeWidth={5}>
        {rects}
      </g>
      <g className="fill-visualize">{rects}</g>
      <g className="fill-none stroke-ink" strokeOpacity={0.4} strokeWidth={1.2}>
        {rects}
      </g>
    </>
  );
}

/** Thẻ giấy viền mực có bóng đổ. */
export function Card({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y + 4} width={130} height={130} rx={16} className="fill-ink" />
      <rect
        x={x}
        y={y}
        width={130}
        height={130}
        rx={16}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
    </>
  );
}

/** Hộp 5 × 5 đã xếp kín (giấy, gạch chéo, đường chia ô), khoảng trống màu bảng viền phấn gạch đứt. */
export function Box() {
  const [left, top] = BOX;
  return (
    <>
      <rect x={left} y={top + 4} width={BOX_SIDE} height={BOX_SIDE} className="fill-ink" />
      <rect x={left} y={top} width={BOX_SIDE} height={BOX_SIDE} className="fill-paper" />
      <path d={HATCH} className="fill-none stroke-ink" strokeOpacity={0.18} strokeWidth={1.6} />
      <path d={BOX_GRID} className="fill-none stroke-ink" strokeOpacity={0.3} strokeWidth={1} />
      <g className="fill-board">
        {GAP.map(([x, y]) => (
          <rect
            key={`${x},${y}`}
            x={left + x * CELL}
            y={top + y * CELL}
            width={CELL}
            height={CELL}
          />
        ))}
      </g>
      <path
        d={GAP_OUTLINE}
        {...CHALK}
        className="stroke-chalk"
        strokeWidth={3}
        strokeDasharray="7 4.5"
        strokeLinecap="butt"
      />
      <rect
        x={left}
        y={top}
        width={BOX_SIDE}
        height={BOX_SIDE}
        className="fill-none stroke-ink"
        strokeWidth={4}
      />
    </>
  );
}

/**
 * Hình minh hoạ Mảnh vừa khít (màn Hướng dẫn, thẻ game): hộp 5 × 5 có khoảng trống chữ L ở góc
 * phải dưới; dưới trái là chữ L xoay 90°, khoanh phấn vàng + ✓, mũi tên phấn cong từ thẻ vào khoảng
 * trống kèm icon xoay (↺: mảnh quay ngược 90° là khớp); dưới phải là bản lật gương xoay 90°, gạch
 * chéo + icon gương. Đặt trên nền bảng (`bg-board`).
 */
export function PieceFitHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="80 4 428 352" aria-hidden className={cn("overflow-visible", className)}>
      <Box />

      {/* Hai thẻ lựa chọn */}
      <Card x={110} y={196} />
      <Piece cells={TURNED} />
      <Card x={320} y={196} />
      <Piece cells={MIRRORED} />

      {/* Mũi tên phấn cong từ thẻ trái vào khoảng trống, kèm icon xoay ngược ↺ */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={3.5}>
        <path d="M226 190 C238 160 290 178 304 146" />
        <path d="M294.3 153.1 L304 146 L305.3 157.9" />
      </g>
      <g
        {...CHALK}
        className="stroke-chalk"
        strokeWidth={2.6}
        transform="translate(281 196) scale(-1 1)"
      >
        <path d="M-12 -6 A13 13 0 1 1 -6 12" />
        <path d="M-0.3 9.3 L-9.6 10.2 L-4.7 18.3" />
      </g>

      {/* Đúng: khoanh phấn vàng + ✓ */}
      <g {...CHALK} className="stroke-primary">
        <ellipse cx={175} cy={261} rx={86} ry={84} strokeWidth={4} />
        <path d="M86 200 L98 214 L122 184" strokeWidth={6} />
      </g>

      {/* Sai: gạch chéo + icon gương (gạch đứt, hai mũi tên ngược chiều) */}
      <g {...CHALK}>
        <path d="M326 202 L444 320 M444 202 L326 320" className="stroke-paper" strokeWidth={10} />
        <path
          d="M326 202 L444 320 M444 202 L326 320"
          className="stroke-destructive"
          strokeWidth={5}
        />
      </g>
      <circle
        cx={478}
        cy={206}
        r={22}
        filter="url(#chalk)"
        className="fill-board stroke-chalk"
        strokeWidth={2.5}
      />
      <g {...CHALK} className="stroke-chalk" strokeWidth={3} transform="translate(478 206)">
        <path d="M0 -13 L0 13" strokeWidth={2.4} strokeDasharray="3.5 3" />
        <path d="M-4 0 L-15 0 M-11 -4 L-15 0 L-11 4 M4 0 L15 0 M11 -4 L15 0 L11 4" />
      </g>
    </svg>
  );
}
