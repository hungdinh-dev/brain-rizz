import { cn } from "@/lib/utils";

/** Màu riêng của bản mẫu (TopViewHowTo): mặt bệ, mặt trên và mặt trái của khối, dải mép phải. */
const SLAB_TOP = "#f3eadf";
const CUBE_TOP = "#b7adea";
const CUBE_LEFT = "#8f82cc";
const SLAB_SIDE = "#d9cfbd";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Mô hình chữ L: (dx, dy) đỉnh sau mặt trên của từng khối so với đỉnh sau của bệ, theo thứ tự vẽ. */
const CUBES: readonly (readonly [number, number])[] = [
  [0, -19],
  [0, -38],
  [-16.45, -9.5],
  [-32.91, 0],
  [-16.45, 9.5],
];

/** Một khối lập phương nhỏ: mặt trên, mặt trái (quay về mép trước), mặt phải. */
function Cube({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="stroke-ink"
      strokeWidth={2.5}
      strokeLinejoin="round"
    >
      <path d="M0 0 L16.45 9.5 L0 19 L-16.45 9.5 Z" fill={CUBE_TOP} />
      <path d="M-16.45 9.5 L0 19 L0 38 L-16.45 28.5 Z" fill={CUBE_LEFT} />
      <path d="M16.45 9.5 L0 19 L0 38 L16.45 28.5 Z" className="fill-visualize" />
    </g>
  );
}

/** Bệ 3×3 nghiêng: mặt trên có lưới mờ, mép trước–trái tô cam, mép trước–phải sẫm. */
function Slab() {
  return (
    <>
      <path
        d="M0 0 L49.36 28.5 L0 57 L-49.36 28.5 Z"
        fill={SLAB_TOP}
        className="stroke-ink"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M16.45 9.5 L-32.91 38 M32.91 19 L-16.45 47.5 M-16.45 9.5 L32.91 38 M-32.91 19 L16.45 47.5"
        fill="none"
        className="stroke-ink"
        strokeOpacity={0.3}
        strokeWidth={1.5}
      />
      <path
        d="M-49.36 28.5 L0 57 L0 62 L-49.36 33.5 Z"
        className="fill-identify stroke-ink"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M0 57 L49.36 28.5 L49.36 33.5 L0 62 Z"
        fill={SLAB_SIDE}
        className="stroke-ink"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </>
  );
}

/** Thẻ hình chiếu 130×130: lưới 3×3 ô 24 px, ô tô tím, vạch cam dưới lưới. */
function ViewCard({ x, cells }: { x: number; cells: readonly (readonly [number, number])[] }) {
  const gx = x + 29;
  const gy = 222;
  return (
    <>
      <rect x={x} y={204} width={130} height={130} rx={16} className="fill-ink" />
      <rect
        x={x}
        y={200}
        width={130}
        height={130}
        rx={16}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
      <rect
        x={gx}
        y={gy}
        width={72}
        height={72}
        fill={SLAB_TOP}
        className="stroke-ink"
        strokeWidth={2.5}
      />
      <path
        d={`M${gx + 24} ${gy} v72 M${gx + 48} ${gy} v72 M${gx} ${gy + 24} h72 M${gx} ${gy + 48} h72`}
        fill="none"
        className="stroke-ink"
        strokeOpacity={0.3}
        strokeWidth={1.5}
      />
      {cells.map(([c, r]) => (
        <rect
          key={`${c},${r}`}
          x={gx + 24 * c}
          y={gy + 24 * r}
          width={24}
          height={24}
          className="fill-visualize stroke-ink"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ))}
      <rect
        x={gx}
        y={300}
        width={72}
        height={7}
        rx={2.5}
        className="fill-identify stroke-ink"
        strokeWidth={2}
      />
    </>
  );
}

/** Hình chiếu đúng: chữ L (cột trái + ô góc dưới), và bản lật gương của nó. */
const L_SHAPE = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
] as const;
const L_MIRRORED = [
  [2, 0],
  [2, 1],
  [1, 2],
  [2, 2],
] as const;

/**
 * Hình minh hoạ Nhìn từ trên (màn Hướng dẫn, thẻ game): trên là thẻ mô hình, bốn cột khối xếp chữ L
 * trên bệ 3×3, mép trước tô cam, huy hiệu con mắt + mũi tên chỉ nhìn từ trên xuống. Dưới trái: lưới
 * tô chữ L, vạch cam ở cạnh dưới, khoanh phấn vàng + ✓, mũi tên phấn cong từ mô hình xuống kèm con
 * mắt phấn nhìn xuống. Dưới phải: chữ L lật gương, gạch chéo + icon gương. Đặt trên nền bảng.
 */
export function TopViewHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Thẻ mô hình + huy hiệu con mắt và mũi tên chỉ xuống */}
      <rect x={200} y={22} width={160} height={136} rx={16} className="fill-ink" />
      <rect
        x={200}
        y={18}
        width={160}
        height={136}
        rx={16}
        className="fill-paper stroke-ink"
        strokeWidth={5}
      />
      <circle cx={280} cy={18} r={13} fill={SLAB_TOP} className="stroke-ink" strokeWidth={2} />
      <path
        d="M268 18 C271.5 12.5 275.5 11 280 11 C284.5 11 288.5 12.5 292 18 C288.5 23.5 284.5 25 280 25 C275.5 25 271.5 23.5 268 18 Z"
        className="fill-paper stroke-ink"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <circle cx={280} cy={18} r={3.5} className="fill-visualize stroke-ink" strokeWidth={1.2} />
      <circle cx={280} cy={18} r={1.3} className="fill-ink" />
      <path
        d="M280 35 L280 46 M275.5 41.5 L280 47 L284.5 41.5"
        fill="none"
        className="stroke-ink"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(280 90)">
        <Slab />
        {CUBES.map(([x, y]) => (
          <Cube key={`${x},${y}`} x={x} y={y} />
        ))}
      </g>

      {/* Hai thẻ hình chiếu */}
      <ViewCard x={110} cells={L_SHAPE} />
      <ViewCard x={320} cells={L_MIRRORED} />

      {/* Mũi tên phấn cong từ mô hình xuống thẻ trái, kèm con mắt phấn nhìn xuống */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={3.5}>
        <path d="M194 86 C146 86 128 134 158 190" />
        <path d="M146.1 182.6 L158 190 L158.4 176" />
      </g>
      <g {...CHALK} className="stroke-chalk" strokeWidth={2.6} transform="translate(100 96)">
        <path d="M-14 0 C-10 -7 -5 -9 0 -9 C5 -9 10 -7 14 0 C10 7 5 9 0 9 C-5 9 -10 7 -14 0 Z" />
        <circle cx={0} cy={0} r={3.5} />
        <path d="M0 15 L0 33 M-6 27 L0 34 L6 27" />
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
