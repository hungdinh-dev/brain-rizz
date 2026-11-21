import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  NumberBadge,
  popIn,
  RectRing,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { cubeOrigin, type Point } from "./art";
import { Card, CUBES, Cube, CubeCountHowTo, GHOST, Slab } from "./CubeCountHowTo";

/** Gốc mô hình trên sân khấu và tỉ lệ (như hình minh hoạ, dời 30, 6). */
const ORIGIN: Point = [185, 197.7];
const SCALE = 0.7;
/** Thẻ mô hình: góc trên trái, cỡ; tâm để nảy. */
const MODEL = { x: 70, y: 58, w: 230, h: 250 } as const;
/** Bốn thẻ số 96 × 68: góc trên trái và số. Thẻ 6 là đáp án. */
const TILES = [
  { x: 360, y: 124, n: 4 },
  { x: 472, y: 124, n: 5 },
  { x: 360, y: 210, n: 6 },
  { x: 472, y: 210, n: 7 },
] as const;
const PICK: Point = [408, 244];

/** Chỗ đặt số đếm so với gốc khối: tâm mặt trên, tâm mặt trái, giữa cạnh trước, tâm khối. */
const SPOT = { top: [0, 28], left: [-24, 70], front: [0, 84], ghost: [0, 56] } as const;

/** Toạ độ sân khấu của số đếm trên khối (r, c, k). */
function countAt(r: number, c: number, k: number, spot: keyof typeof SPOT): Point {
  const [x, y] = cubeOrigin(r, c, k);
  const [dx, dy] = SPOT[spot];
  return [ORIGIN[0] + (x + dx) * SCALE, ORIGIN[1] + (y + dy) * SCALE];
}

/**
 * Thứ tự đếm: cột sau từ trên xuống (khối dưới cùng bị che, hiện nét đứt), cột phải, cột trái.
 * Tổng 6 = thẻ đáp án.
 */
const COUNT: readonly { at: Point; ms: number; hidden?: boolean }[] = [
  { at: countAt(0, 0, 2, "top"), ms: 1100 },
  { at: countAt(0, 0, 1, "left"), ms: 1300 },
  { at: countAt(0, 0, 0, "ghost"), ms: 1500, hidden: true },
  { at: countAt(0, 1, 1, "top"), ms: 1700 },
  { at: countAt(0, 1, 0, "front"), ms: 1900 },
  { at: countAt(1, 0, 0, "left"), ms: 2100 },
];

/**
 * Kịch bản Đếm khối (CR-021, T = 5.000 ms): nhìn mô hình trên bệ → đếm lần lượt 1…6, khối bị che
 * dưới cột sau hiện nét đứt khi tới lượt → chạm thẻ 6 → ✓.
 */
export const CUBE_COUNT_SCRIPT = defineScript({
  id: "cbc",
  T: 5000,
  steps: [0, 1000, 2400],
  hand: {
    moves: [
      [2300, 450, PICK],
      [3300, 400, null],
    ],
    taps: [2850],
  },
  tracks: {
    model: track().to(400, 200, { s: 1.04 }, "glide").to(600, 200, { s: 1 }, "glide"),
    ghost: track({ o: 0 }).fade(1450, 200),
    ...Object.fromEntries(COUNT.map(({ ms }, i) => [`n${i}`, popIn(ms)])),
    pick: track().bump(2910, 1.1, 180),
    ring: popIn(2910),
    ok: popIn(2970),
    rp: ripple(2850),
  },
});

/** Thẻ số 96 × 68 vẽ quanh tâm 0,0. */
function Tile({ n }: { n: number }) {
  return (
    <>
      <Card x={-48} y={-34} w={96} h={68} r={14} border={3} />
      <text
        y={14}
        textAnchor="middle"
        fontSize={40}
        className="fill-ink font-display font-extrabold"
      >
        {n}
      </text>
    </>
  );
}

/** Hình minh hoạ động Đếm khối (màn Hướng dẫn); khung tĩnh = `CubeCountHowTo`. */
export function CubeCountDemo(props: DemoProps) {
  const cx = MODEL.x + MODEL.w / 2;
  const cy = MODEL.y + MODEL.h / 2;
  return (
    <DemoStage
      script={CUBE_COUNT_SCRIPT}
      still={CubeCountHowTo}
      {...props}
      backdrop={
        <g
          fill="none"
          className="stroke-chalk filter-[url(#chalk)]"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M312 156 C330 148 346 156 352 174" />
          <path d="M343 166 L352 174 L354.4 162.2" />
        </g>
      }
    >
      {/* Thẻ mô hình: bệ 2×2, cột sau 3 tầng, cột phải 2, cột trái 1 */}
      <A k="model" x={cx} y={cy}>
        <g transform={`translate(${-cx} ${-cy})`}>
          <Card x={MODEL.x} y={MODEL.y} w={MODEL.w} h={MODEL.h} r={16} border={4} />
          <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${SCALE})`}>
            <Slab />
            {CUBES.map(({ r, c, k, top }) => (
              <Cube key={`${r},${c},${k}`} at={cubeOrigin(r, c, k)} top={top} />
            ))}
            <A k="ghost">
              <path
                d={GHOST}
                className="fill-paper stroke-ink"
                fillOpacity={0.5}
                strokeWidth={6}
                strokeDasharray="12 9"
                strokeLinejoin="round"
              />
            </A>
          </g>
        </g>
      </A>

      {/* Bốn thẻ số */}
      {TILES.map(({ x, y, n }) =>
        n === 6 ? (
          <A key={n} k="pick" x={x + 48} y={y + 34}>
            <Tile n={n} />
          </A>
        ) : (
          <g key={n} transform={`translate(${x + 48} ${y + 34})`}>
            <Tile n={n} />
          </g>
        ),
      )}

      {/* Số đếm 1…6 trên từng khối; khối bị che dùng huy hiệu hồng */}
      {COUNT.map(({ at: [x, y], hidden }, i) => (
        <NumberBadge
          key={`${x},${y}`}
          k={`n${i}`}
          x={x}
          y={y}
          n={i + 1}
          tone={hidden ? "memorize" : "paper"}
        />
      ))}

      <RectRing k="ring" x={PICK[0]} y={PICK[1]} w={112} h={84} rx={18} />
      <Mark k="ok" x={PICK[0] + 52} y={PICK[1] - 38} kind="ok" />
      <Ripple k="rp" x={PICK[0]} y={PICK[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
