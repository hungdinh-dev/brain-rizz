import { GAMES, type GameId } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";

/** Số vòng quay trọn trước khi dừng. */
const SPIN_TURNS = 5;
const C = 240;
const R = 220;

/** Màu lát theo nhóm kỹ năng của game (fill SVG). */
const SLICE_FILL = {
  identify: "fill-identify",
  memorize: "fill-memorize",
  analyze: "fill-analyze",
  compute: "fill-compute",
  visualize: "fill-visualize",
} as const;

/** Toạ độ điểm trên đường tròn tâm (C, C), góc tính theo độ từ trục x (SVG: chiều kim đồng hồ). */
const xy = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)] as const;
};
const point = (deg: number, r: number) =>
  xy(deg, r)
    .map((v) => v.toFixed(2))
    .join(" ");

/** Góc quay cuối để lát `target` dừng đúng dưới kim (kim ở đỉnh, lát 0 nằm ở đỉnh khi chưa quay). */
export function finalRotation(slices: readonly GameId[], target: string): number {
  const index = Math.max(0, slices.indexOf(target as GameId));
  return 360 * SPIN_TURNS - index * (360 / slices.length);
}

interface LuckyWheelProps {
  slices: readonly GameId[];
  /** Góc đang quay (độ, theo chiều kim đồng hồ) */
  rotation: number;
  className?: string;
}

/** Vòng quay nhãn dán: mỗi lát một game (màu theo nhóm kỹ năng), kim vàng ở đỉnh, linh vật ở giữa. */
export function LuckyWheel({ slices, rotation, className }: LuckyWheelProps) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const step = 360 / slices.length;
  const names = slices.map((id) => text(id).title);

  return (
    <div className={cn("relative aspect-square pt-[5%]", className)}>
      <svg
        viewBox="0 0 480 480"
        role="img"
        aria-label={t("gameSelect.wheelLabel", { count: slices.length, games: names.join(", ") })}
        className="size-full drop-shadow-[0_8px_0_var(--color-sticker)]"
      >
        <circle cx={C} cy={C} r={236} className="fill-sticker" />
        <g transform={`rotate(${rotation} ${C} ${C})`}>
          {slices.map((id, i) => {
            const fill = SLICE_FILL[GAMES[id].category];
            const a0 = -90 - step / 2 + i * step;
            return slices.length === 1 ? (
              <circle
                key={id}
                cx={C}
                cy={C}
                r={R}
                className={cn(fill, "stroke-sticker")}
                strokeWidth={4}
              />
            ) : (
              <path
                key={id}
                d={`M${C} ${C} L${point(a0, R)} A${R} ${R} 0 ${step > 180 ? 1 : 0} 1 ${point(a0 + step, R)} Z`}
                className={cn(fill, "stroke-sticker")}
                strokeWidth={4}
                strokeLinejoin="round"
              />
            );
          })}
          {slices.map((id, i) => (
            <text
              key={id}
              transform={`rotate(${-90 + i * step} ${C} ${C})`}
              x={442}
              y={C}
              textAnchor="end"
              dominantBaseline="central"
              className={cn(
                "font-display text-[20px] font-extrabold",
                GAMES[id].category === "visualize" ? "fill-paper" : "fill-ink",
              )}
            >
              {names[i]}
            </text>
          ))}
          {slices.length > 1 &&
            slices.map((id, i) => {
              const [cx, cy] = xy(-90 - step / 2 + i * step, 226);
              return (
                <circle
                  key={id}
                  cx={cx}
                  cy={cy}
                  r={6}
                  className="fill-paper stroke-sticker"
                  strokeWidth={2.5}
                />
              );
            })}
        </g>
      </svg>
      {/* Kim chỉ ở đỉnh */}
      <svg
        viewBox="0 0 50 60"
        aria-hidden
        className="absolute top-0 left-1/2 w-[10.4%] -translate-x-1/2"
      >
        <path
          d="M5 5 L45 5 L25 54 Z"
          className="fill-primary stroke-sticker"
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
      {/* Tâm vòng quay */}
      <span
        aria-hidden
        className="absolute top-[52.5%] left-1/2 grid size-[21%] -translate-1/2 place-items-center rounded-full border-4 border-sticker bg-paper shadow-sticker-sm"
      >
        <BrainMascot size={64} className="size-[78%]" />
      </span>
    </div>
  );
}
