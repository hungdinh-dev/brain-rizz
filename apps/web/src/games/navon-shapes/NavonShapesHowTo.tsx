import { NAVON_GRID, NAVON_MASKS } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Lưới hình to 7 × 7, ô 17, hình nhỏ là đĩa bán kính 6 (~72 % ô, như scene). */
const CELL = 17;
const DOT = 6;
/** Khung tròn bán kính 92; khung vuông 184 × 184 viền chuỗi 14 ô vuông rỗng 9 × 9 mỗi cạnh. */
const RING_R = 92;
const SQUARE = { size: 184, link: 9, perSide: 14 };
const PANELS = { round: { x: 140, y: 118 }, square: { x: 420, y: 118 } } as const;
const BUTTON_Y = 254;

const TICK = "M-12 1 L-3 10 L13 -9";
const ARROW = "M-9 0 L9 0 M2 -7 L9 0 L2 7";
const TRIANGLE_ICON = "M0 -14 L16 14 L-16 14 Z";

/** Toạ độ góc trên trái của từng ô trong chuỗi ô vuông quanh hình vuông cạnh `size` tâm (0, 0). */
export function squareLinks(size: number, link: number, perSide: number): [number, number][] {
  const half = size / 2;
  const step = (size - link) / (perSide - 1);
  const out = new Map<string, [number, number]>();
  for (let k = 0; k < perSide; k++) {
    const p = -half + k * step;
    for (const at of [
      [p, -half],
      [p, half - link],
      [-half, p],
      [half - link, p],
    ] as [number, number][]) {
      out.set(at.map(Math.round).join(":"), at);
    }
  }
  return [...out.values()];
}

const LINKS = squareLinks(SQUARE.size, SQUARE.link, SQUARE.perSide);
const MINI_LINKS = squareLinks(26, 5, 4);

/** Hình to: tam giác ghép từ các đĩa phấn nhỏ (như câu "tam giác to ghép từ hình tròn"). */
function NavonTriangle({ x, y }: { x: number; y: number }) {
  const mid = (NAVON_GRID - 1) / 2;
  return (
    <g transform={`translate(${x} ${y})`} className={cn(CHALK, "fill-chalk")}>
      {NAVON_MASKS.triangle.map((cell) => (
        <circle
          key={`${cell.col}-${cell.row}`}
          cx={(cell.col - mid) * CELL}
          cy={(cell.row - mid) * CELL}
          r={DOT}
        />
      ))}
    </g>
  );
}

/** Khung tròn: tấm bảng tô đậm, viền một nét phấn liền. */
function RoundFrame({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={RING_R} className="fill-board-shade" />
      <circle r={RING_R} fill="none" strokeWidth={5} className={cn(CHALK, "stroke-chalk")} />
    </g>
  );
}

/** Khung vuông: tấm bảng tô đậm góc vuông, viền là chuỗi ô vuông phấn nhỏ rỗng. */
function SquareFrame({ x, y }: { x: number; y: number }) {
  const half = SQUARE.size / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={-half}
        y={-half}
        width={SQUARE.size}
        height={SQUARE.size}
        className="fill-board-shade"
      />
      <g fill="none" strokeWidth={2.5} className={cn(CHALK, "stroke-chalk")}>
        {LINKS.map(([lx, ly]) => (
          <rect
            key={`${lx}-${ly}`}
            x={lx + 1.25}
            y={ly + 1.25}
            width={SQUARE.link - 2.5}
            height={SQUARE.link - 2.5}
          />
        ))}
      </g>
    </g>
  );
}

/** Hình trên nút: tam giác hoặc đĩa đặc. */
function ButtonShape({ shape, className }: { shape: "triangle" | "circle"; className: string }) {
  return shape === "triangle" ? (
    <path d={TRIANGLE_ICON} className={className} />
  ) : (
    <circle r={14} className={className} />
  );
}

/** Nút hình: sáng vàng + ✓ (đúng) hoặc mờ, gạch chéo (sai). */
function ShapeButton({
  x,
  shape,
  right,
}: {
  x: number;
  shape: "triangle" | "circle";
  right: boolean;
}) {
  if (right) {
    return (
      <g transform={`translate(${x} ${BUTTON_Y})`}>
        <rect x={-32} y={-23} width={64} height={54} rx={14} className="fill-ink" />
        <rect
          x={-32}
          y={-27}
          width={64}
          height={54}
          rx={14}
          strokeWidth={3.5}
          className="fill-primary stroke-ink"
        />
        <g transform="translate(0 -1)">
          <ButtonShape shape={shape} className="fill-ink" />
        </g>
        <g transform="translate(30 -26) scale(0.62)">
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
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${BUTTON_Y})`} opacity={0.55}>
      <rect
        x={-32}
        y={-27}
        width={64}
        height={54}
        rx={14}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
      <g transform="translate(0 -1)">
        <ButtonShape shape={shape} className={cn(CHALK, "fill-chalk")} />
      </g>
      <path
        d="M-28 -22 L28 20"
        strokeWidth={5}
        strokeLinecap="round"
        className="stroke-destructive"
      />
    </g>
  );
}

/** Biểu tượng chip luật: [khung tròn] → [một hình to] hoặc [khung vuông] → [kính lúp trên hình nhỏ]. */
function RuleIcon({ x, kind }: { x: number; kind: "round" | "square" }) {
  return (
    <g
      transform={`translate(${x} 322)`}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={CHALK}
    >
      {kind === "round" ? (
        <circle cx={-40} r={13} fill="none" strokeWidth={3.5} className="stroke-chalk" />
      ) : (
        <g transform="translate(-40 0)" className="fill-chalk">
          {MINI_LINKS.map(([lx, ly]) => (
            <rect key={`${lx}-${ly}`} x={lx} y={ly} width={5} height={5} />
          ))}
        </g>
      )}
      <path d={ARROW} fill="none" strokeWidth={3.5} className="stroke-chalk" />
      {kind === "round" ? (
        <path d={TRIANGLE_ICON} transform="translate(40 0)" className="fill-chalk" />
      ) : (
        <g transform="translate(42 0)">
          <g className="fill-chalk">
            <circle cx={-15} cy={12} r={3.2} />
            <circle cx={-4} cy={14} r={3.2} />
            <circle cx={-5} cy={-5} r={5} />
          </g>
          <circle cx={-5} cy={-5} r={11} fill="none" strokeWidth={3} className="stroke-primary" />
          <path d="M3 3 L13 13" strokeWidth={4.5} className="stroke-primary" />
        </g>
      )}
    </g>
  );
}

/**
 * Hình minh hoạ Hình to hình nhỏ (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả:
 * hai ô cùng một tam giác to ghép từ hình tròn nhỏ. Ô trái trong khung tròn (viền phấn liền): nút
 * tam giác sáng + ✓, nút tròn mờ gạch chéo. Ô phải trong khung vuông (viền chuỗi ô vuông nhỏ): nút
 * tròn sáng + ✓, nút tam giác mờ gạch chéo. Dưới mỗi ô là biểu tượng của chip luật. Đặt trên nền bảng.
 */
export function NavonShapesHowTo({ className }: { className?: string }) {
  const { round, square } = PANELS;
  return (
    <svg viewBox="24 18 512 330" aria-hidden className={cn("overflow-visible", className)}>
      {/* Ô trái: khung tròn → hình to */}
      <RoundFrame x={round.x} y={round.y} />
      <NavonTriangle x={round.x} y={round.y} />
      <ShapeButton x={round.x - 36} shape="triangle" right />
      <ShapeButton x={round.x + 36} shape="circle" right={false} />
      <RuleIcon x={round.x} kind="round" />

      {/* Ô phải: khung vuông → hình nhỏ */}
      <SquareFrame x={square.x} y={square.y} />
      <NavonTriangle x={square.x} y={square.y} />
      <ShapeButton x={square.x - 36} shape="circle" right />
      <ShapeButton x={square.x + 36} shape="triangle" right={false} />
      <RuleIcon x={square.x} kind="square" />
    </svg>
  );
}
