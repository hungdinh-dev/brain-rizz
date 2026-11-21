import { cn } from "@/lib/utils";
import {
  CUBE_LEFT,
  CUBE_LIGHT,
  CUBE_RIGHT,
  CUBE_TOP,
  cubeOrigin,
  HALF_H,
  type Point,
  SLAB_LIGHT,
  SLAB_THICK,
  slabCorners,
  slabGrid,
  svgPoints,
} from "./art";

/** Mô hình của hình minh hoạ: bệ 2×2, cột sau 3 tầng, cột phải 2, cột trái 1, ô trước trống. */
const HEIGHTS = [
  [3, 2],
  [1, 0],
];
/** Gốc mô hình và tỉ lệ thu nhỏ (như artboard CubeCountHowTo). */
const ORIGIN: Point = [155, 191.7];
const SCALE = 0.7;

/** Khối theo thứ tự vẽ r + c + k tăng dần; `top`: khối trên cùng của cột (mặt trên sáng vàng). */
export const CUBES = HEIGHTS.flatMap((row, r) =>
  row.flatMap((h, c) => Array.from({ length: h }, (_, k) => ({ r, c, k, top: k === h - 1 }))),
).sort((a, b) => a.r + a.c + a.k - (b.r + b.c + b.k));

/** Thẻ số nhỏ (96×68) bên phải: góc trên trái và số ghi trên thẻ. Thẻ 6 là đáp án. */
const TILES = [
  { x: 330, y: 118, n: 4 },
  { x: 442, y: 118, n: 5 },
  { x: 330, y: 204, n: 6 },
  { x: 442, y: 204, n: 7 },
] as const;

/** Số thứ tự các bước (vòng phấn): tâm vòng. */
const STEPS: readonly Point[] = [
  [96, 138],
  [212, 96],
  [312, 284],
];

/** Khối bị che dưới cùng của cột sau, vẽ nét đứt như nhìn xuyên qua. */
export const GHOST =
  "M0 -56 L48.5 -28 L48.5 28 L0 56 L-48.5 28 L-48.5 -28 Z M-48.5 -28 L0 0 L48.5 -28 M0 0 L0 56";
const HAND =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Bệ 2×2: mặt trên, đường chia ô, hai mặt bên. */
export function Slab() {
  const s = slabCorners(2, 2);
  const down = ([x, y]: Point): Point => [x, y + SLAB_THICK];
  return (
    <g className="stroke-ink" strokeWidth={4} strokeLinejoin="round">
      <polygon points={svgPoints([s.top, s.right, s.bottom, s.left])} fill={SLAB_LIGHT.top} />
      <g strokeOpacity={0.3} strokeWidth={2.5}>
        {slabGrid(2, 2).map(([[x1, y1], [x2, y2]]) => (
          <line key={`${x1},${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <polygon
        points={svgPoints([s.left, s.bottom, down(s.bottom), down(s.left)])}
        fill={SLAB_LIGHT.left}
      />
      <polygon
        points={svgPoints([s.bottom, s.right, down(s.right), down(s.bottom)])}
        fill={SLAB_LIGHT.right}
      />
    </g>
  );
}

/** Một khối: mặt trên vàng (token `primary`) nếu là khối trên cùng của cột. */
export function Cube({ at, top }: { at: Point; top: boolean }) {
  return (
    <g className="stroke-ink" strokeWidth={4} strokeLinejoin="round">
      <polygon
        points={svgPoints(CUBE_TOP, at)}
        fill={top ? undefined : CUBE_LIGHT.top}
        className={top ? "fill-primary" : undefined}
      />
      <polygon points={svgPoints(CUBE_LEFT, at)} fill={CUBE_LIGHT.left} />
      <polygon points={svgPoints(CUBE_RIGHT, at)} fill={CUBE_LIGHT.right} />
    </g>
  );
}

/** Thẻ giấy viền mực có bóng đổ. */
export function Card({
  x,
  y,
  w,
  h,
  r,
  border,
}: Record<"x" | "y" | "w" | "h" | "r" | "border", number>) {
  return (
    <>
      <rect x={x} y={y + 4} width={w} height={h} rx={r} className="fill-ink" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        className="fill-paper stroke-ink"
        strokeWidth={border}
      />
    </>
  );
}

/**
 * Hình minh hoạ Đếm khối (màn Hướng dẫn, thẻ game): bên trái là thẻ mô hình trên bệ 2×2, mặt trên
 * ba cột sáng vàng ghi số tầng 3, 2, 1; khối bị che dưới cột sau vẽ nét đứt. Mũi tên phấn sang bốn
 * thẻ 4, 5, 6, 7; thẻ 6 được khoanh phấn vàng, có bàn tay chỉ vào. Số phấn 1, 2, 3 đánh dấu thứ tự
 * các bước. Đặt trên nền bảng (`bg-board`).
 */
export function CubeCountHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Thẻ mô hình */}
      <Card x={40} y={52} w={230} h={250} r={16} border={4} />
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${SCALE})`}>
        <Slab />
        {CUBES.map(({ r, c, k, top }) => (
          <Cube key={`${r},${c},${k}`} at={cubeOrigin(r, c, k)} top={top} />
        ))}
        <path
          d={GHOST}
          className="fill-paper stroke-ink"
          fillOpacity={0.5}
          strokeWidth={6}
          strokeDasharray="12 9"
          strokeLinejoin="round"
        />
        <g textAnchor="middle" fontSize={40} className="fill-ink font-display font-extrabold">
          {CUBES.filter((cube) => cube.top).map(({ r, c, k }) => {
            const [x, y] = cubeOrigin(r, c, k);
            return (
              <text key={`${r},${c}`} x={x} y={y + HALF_H + 13}>
                {k + 1}
              </text>
            );
          })}
        </g>
      </g>

      {/* Mũi tên phấn sang các thẻ số */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={3.5}>
        <path d="M282 150 C300 142 316 150 322 168" />
        <path d="M313 160 L322 168 L324.4 156.2" />
      </g>

      {/* Bốn thẻ số */}
      {TILES.map(({ x, y }) => (
        <Card key={`${x},${y}`} x={x} y={y} w={96} h={68} r={14} border={3} />
      ))}
      <g textAnchor="middle" fontSize={40} className="fill-ink font-display font-extrabold">
        {TILES.map(({ x, y, n }) => (
          <text key={n} x={x + 48} y={y + 48}>
            {n}
          </text>
        ))}
      </g>

      {/* Đúng: khoanh phấn vàng thẻ 6 + bàn tay chỉ vào */}
      <ellipse
        cx={378}
        cy={238}
        rx={64}
        ry={48}
        {...CHALK}
        className="stroke-primary"
        strokeWidth={4}
      />
      <path
        d={HAND}
        transform="translate(402 254) scale(2) translate(-11 -3.5)"
        filter="url(#chalk)"
        className="fill-board stroke-chalk"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Số thứ tự các bước */}
      {STEPS.map(([x, y], i) => (
        <g key={`${x},${y}`} filter="url(#chalk)">
          <circle cx={x} cy={y} r={12} className="fill-board stroke-chalk" strokeWidth={2.5} />
          <text
            x={x}
            y={y + 6}
            textAnchor="middle"
            fontSize={17}
            className="fill-chalk font-display font-extrabold"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
