import { cn } from "@/lib/utils";

type Cell = readonly [x: number, y: number];

/** Cạnh một ô của lưới (đơn vị viewBox). */
const CELL = 26;
/** Lưới chữ thập 6 ô (góc trên trái từng ô, so với tâm lưới). */
const NET: readonly Cell[] = [
  [-52, -39],
  [-52, -13],
  [-26, -13],
  [0, -13],
  [26, -13],
  [-26, 13],
];
/** Các cạnh chung giữa hai ô kề nhau (đường gấp nét đứt). */
const FOLDS = "M-52 -13 L-26 -13 M-26 -13 L-26 13 M0 -13 L0 13 M-26 13 L0 13 M26 -13 L26 13";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export type MarkSymbol = "dot" | "ring" | "plus";

/** Ký hiệu kem viền mực (cỡ ô 56 px, tâm 0,0), như `<g id="fb-h-…">` của bản mẫu. */
function Mark({ symbol, transform }: { symbol: MarkSymbol; transform: string }) {
  if (symbol === "dot") {
    return (
      <circle r={10.5} transform={transform} className="fill-paper stroke-ink" strokeWidth={3.5} />
    );
  }
  const shape = symbol === "ring" ? <circle r={12.5} /> : <path d="M0 -14 L0 14 M-14 0 L14 0" />;
  return (
    <g transform={transform} fill="none" strokeLinecap="round">
      <g className="stroke-ink" strokeWidth={10.5}>
        {shape}
      </g>
      <g className="stroke-paper" strokeWidth={4}>
        {shape}
      </g>
    </g>
  );
}

/** Thẻ giấy viền mực có bóng đổ. */
export function Card({
  x,
  y,
  size,
  border,
}: {
  x: number;
  y: number;
  size: number;
  border: number;
}) {
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

/** Lưới chữ thập trên thẻ, tâm (cx, cy): viền mực, ô tím, đường gấp, ba ký hiệu. */
export function Net({
  cx,
  cy,
  marks,
}: {
  cx: number;
  cy: number;
  marks: [MarkSymbol, number, number][];
}) {
  const rects = NET.map(([x, y]) => (
    <rect key={`${x},${y}`} x={x} y={y} width={CELL} height={CELL} />
  ));
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className="fill-none stroke-ink" strokeWidth={5}>
        {rects}
      </g>
      <g className="fill-visualize">{rects}</g>
      <path
        d={FOLDS}
        fill="none"
        className="stroke-ink"
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeDasharray="4 2.5"
        strokeDashoffset={-1.25}
      />
      {marks.map(([symbol, x, y]) => (
        <Mark key={symbol} symbol={symbol} transform={`translate(${x} ${y}) scale(0.46)`} />
      ))}
    </g>
  );
}

/**
 * Hình minh hoạ Gấp hộp (màn Hướng dẫn, thẻ game), theo artboard FoldBoxHowTo: thẻ khối mẫu ở trên
 * (chấm ở trên, vòng tròn bên trái, dấu cộng bên phải); dưới trái là lưới chữ thập có ba ký hiệu ở
 * ba ô kề nhau, khoanh phấn vàng + ✓, có mũi tên phấn cong lên khối mẫu kèm icon gấp; dưới phải là
 * cùng dáng lưới nhưng chấm cách vòng tròn một ô (hai mặt đối diện), gạch chéo + icon mặt đối diện.
 * Đặt trên nền bảng (`bg-board`). Mặt trên/phải của khối là màu nhóm Hình dung phủ kem/mực để sáng/tối hơn.
 */
export function FoldBoxHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      <BoxCard />

      {/* Hai thẻ lựa chọn: đúng (ba ký hiệu ở ba ô kề nhau) và sai (chấm đối diện vòng tròn) */}
      <Card x={110} y={200} size={130} border={3} />
      <Net
        cx={175}
        cy={265}
        marks={[
          ["ring", -13, 0],
          ["dot", 13, 0],
          ["plus", -13, 26],
        ]}
      />
      <Card x={320} y={200} size={130} border={3} />
      <Net
        cx={385}
        cy={265}
        marks={[
          ["ring", -13, 0],
          ["dot", 39, 0],
          ["plus", -13, 26],
        ]}
      />

      {/* Mũi tên phấn cong từ lưới đúng lên khối mẫu, kèm icon gấp */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={3.5}>
        <path d="M146 190 C118 130 150 84 212 78" />
        <path d="M200.3 71.1 L212 78 L201.8 87" />
      </g>
      <g {...CHALK} className="stroke-chalk" strokeWidth={2.6} transform="translate(96 124)">
        <path d="M-14 0 L14 0" strokeDasharray="3.5 3" />
        <path d="M-14 0 L-14 14 L14 14 L14 0" />
        <path d="M8 8 C20 2 20 -14 6 -18" />
        <path d="M14 -21 L6 -18 L11.3 -11.3" />
      </g>

      {/* Đúng: khoanh phấn vàng + ✓ */}
      <g {...CHALK} className="stroke-primary">
        <ellipse cx={175} cy={265} rx={86} ry={84} strokeWidth={4} />
        <path d="M246 196 L258 210 L282 180" strokeWidth={6} />
      </g>

      {/* Sai: gạch chéo + icon mặt đối diện (ba ô, ô giữa nét đứt) */}
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
      <g
        filter="url(#chalk)"
        className="stroke-chalk"
        strokeWidth={2.4}
        strokeLinejoin="round"
        transform="translate(478 210)"
      >
        <rect x={-15} y={-4.5} width={9} height={9} className="fill-chalk" />
        <rect x={-4.5} y={-4.5} width={9} height={9} fill="none" strokeDasharray="2.5 2" />
        <rect x={6} y={-4.5} width={9} height={9} className="fill-chalk" />
      </g>
    </svg>
  );
}

/**
 * Thẻ khối mẫu (120 × 120 tại 220, 14): khối isometric tâm mặt trên (280, 54), chấm ở trên, vòng
 * tròn bên trái, dấu cộng bên phải. Dùng chung với hình động `FoldBoxDemo`.
 */
export function BoxCard() {
  const top = "318.11 54 280 32 241.89 54 280 76";
  const left = "280 76 241.89 54 241.89 98 280 120";
  const right = "318.11 54 280 76 280 120 318.11 98";
  return (
    <>
      {/* Thẻ khối mẫu + icon con mắt */}
      <Card x={220} y={14} size={120} border={5} />
      <path
        d="M226 30 C229 25 233 23 237 23 C241 23 245 25 248 30 C245 35 241 37 237 37 C233 37 229 35 226 30 Z"
        className="fill-paper stroke-ink"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={237} cy={30} r={3.5} className="fill-visualize stroke-ink" strokeWidth={1.5} />

      {/* Khối isometric: bóng, mặt trái, mặt phải (tối hơn), mặt trên (sáng hơn) */}
      <g strokeLinejoin="round">
        <polygon
          points="241.89 58 280 36 318.11 58 318.11 102 280 124 241.89 102"
          className="fill-ink stroke-ink"
          strokeWidth={4}
        />
        <polygon points={left} className="fill-visualize" />
        <polygon points={right} className="fill-visualize" />
        <polygon points={right} className="fill-ink" fillOpacity={0.25} />
        <polygon points={top} className="fill-visualize" />
        <polygon points={top} className="fill-paper" fillOpacity={0.3} />
        <g fill="none" className="stroke-ink" strokeWidth={4}>
          <polygon points={left} />
          <polygon points={right} />
          <polygon points={top} />
        </g>
      </g>
      <Mark symbol="ring" transform="matrix(0.68 0.39 0 0.79 260.95 87)" />
      <Mark symbol="plus" transform="matrix(0.68 -0.39 0 0.79 299.05 87)" />
      <Mark symbol="dot" transform="matrix(0.68 -0.39 0.68 0.39 280 54)" />
    </>
  );
}
