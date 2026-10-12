import { cn } from "@/lib/utils";

type Cell = readonly [x: number, y: number];

/** Cạnh một ô của hình (đơn vị viewBox). */
const CELL = 26;
/** Hình mẫu chữ L (`#.` / `#.` / `##`), góc trên trái từng ô. */
const MODEL: readonly Cell[] = [
  [254, 35],
  [254, 61],
  [254, 87],
  [280, 87],
];
/** Chữ L xoay 90° (`###` / `#..`): đúng. */
const TURNED: readonly Cell[] = [
  [136, 239],
  [162, 239],
  [188, 239],
  [136, 265],
];
/** Bản lật gương (chữ J) xoay 90° (`#..` / `###`): sai. */
const MIRRORED: readonly Cell[] = [
  [346, 239],
  [346, 265],
  [372, 265],
  [398, 265],
];

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Hình ghép ô: viền mực ngoài, ô tím nhóm Hình dung, đường chia ô mờ. */
function Figure({ cells }: { cells: readonly Cell[] }) {
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
function Card({ x, y, size, border }: { x: number; y: number; size: number; border: number }) {
  return (
    <>
      <rect x={x} y={y + 4} width={size} height={size} rx={16} className="fill-ink" />
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={16}
        className="fill-paper stroke-ink"
        strokeWidth={border}
      />
    </>
  );
}

/**
 * Hình minh hoạ Xoay hình (màn Hướng dẫn, thẻ game): thẻ mẫu chữ L ở trên; dưới trái là chữ L
 * xoay 90°, khoanh phấn vàng + dấu ✓, có mũi tên phấn cong từ thẻ mẫu sang; dưới phải là bản lật
 * gương xoay 90°, gạch chéo + icon gương. Đặt trên nền bảng (`bg-board`).
 */
export function RotateMatchHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="80 4 428 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Thẻ mẫu + icon con mắt */}
      <Card x={220} y={14} size={120} border={5} />
      <path
        d="M226 30 C229 25 233 23 237 23 C241 23 245 25 248 30 C245 35 241 37 237 37 C233 37 229 35 226 30 Z"
        className="fill-paper stroke-ink"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={237} cy={30} r={3.5} className="fill-visualize stroke-ink" strokeWidth={1.5} />
      <Figure cells={MODEL} />

      {/* Hai thẻ lựa chọn */}
      <Card x={110} y={200} size={130} border={3} />
      <Figure cells={TURNED} />
      <Card x={320} y={200} size={130} border={3} />
      <Figure cells={MIRRORED} />

      {/* Mũi tên phấn cong từ thẻ mẫu sang thẻ trái, kèm icon xoay ↻ */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={3.5}>
        <path d="M214 74 C150 70 130 120 160 186" />
        <path d="M148.6 177.9 L160 186 L161.4 172.1" />
      </g>
      <g {...CHALK} className="stroke-chalk" strokeWidth={2.6} transform="translate(112 100)">
        <path d="M-12 -6 A13 13 0 1 1 -6 12" />
        <path d="M-0.3 9.3 L-9.6 10.2 L-4.7 18.3" />
      </g>

      {/* Đúng: khoanh phấn vàng + ✓ */}
      <g {...CHALK} className="stroke-primary">
        <ellipse cx={175} cy={265} rx={86} ry={84} strokeWidth={4} />
        <path d="M246 196 L258 210 L282 180" strokeWidth={6} />
      </g>

      {/* Sai: gạch chéo + icon gương (gạch đứt, hai mũi tên ngược chiều) */}
      <g {...CHALK}>
        <path d="M326 206 L444 324 M444 206 L326 324" className="stroke-paper" strokeWidth={10} />
        <path
          d="M326 206 L444 324 M444 206 L326 324"
          className="stroke-destructive"
          strokeWidth={5}
        />
      </g>
      <circle
        cx={478}
        cy={210}
        r={22}
        filter="url(#chalk)"
        className="fill-board stroke-chalk"
        strokeWidth={2.5}
      />
      <g {...CHALK} className="stroke-chalk" strokeWidth={3} transform="translate(478 210)">
        <path d="M0 -13 L0 13" strokeWidth={2.4} strokeDasharray="3.5 3" />
        <path d="M-4 0 L-15 0 M-11 -4 L-15 0 L-11 4 M4 0 L15 0 M11 -4 L15 0 L11 4" />
      </g>
    </svg>
  );
}
