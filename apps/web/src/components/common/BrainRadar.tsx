import {
  BRAIN_SKILL_MAX,
  BRAIN_SKILL_REFERENCE,
  CATEGORIES,
  type Category,
} from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type SkillValues = Partial<Record<Category, number>>;

/** Màu chấm đỉnh theo nhóm (token `--color-<nhóm>`), viết sẵn để Tailwind sinh class. */
const DOT_FILL: Record<Category, string> = {
  identify: "fill-identify",
  memorize: "fill-memorize",
  analyze: "fill-analyze",
  compute: "fill-compute",
  visualize: "fill-visualize",
};

const CX = 150;
const CY = 150;
const R = 100;
/** Vòng lưới: 50, 100 (chuẩn, vẽ chấm), 150, 200. */
const RINGS = [50, 100, 150, 200];

/** Toạ độ đỉnh thứ `i` ở giá trị `value` (0 → BRAIN_SKILL_MAX), Nhận diện ở đỉnh trên, theo chiều kim đồng hồ. */
function point(i: number, value: number): [number, number] {
  const angle = ((-90 + i * 72) * Math.PI) / 180;
  const r = (Math.max(0, Math.min(BRAIN_SKILL_MAX, value)) / BRAIN_SKILL_MAX) * R;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

const polygon = (values: (i: number) => number) =>
  CATEGORIES.map((_, i) =>
    point(i, values(i))
      .map((n) => n.toFixed(1))
      .join(","),
  ).join(" ");

/** Vị trí + căn chữ của nhãn trục (tên nhóm + điểm), như bản mẫu khu 14. */
const LABELS: { x: number; y: number; anchor: "middle" | "start" | "end"; stacked: boolean }[] = [
  { x: 150, y: 22, anchor: "middle", stacked: false },
  { x: 256, y: 104, anchor: "start", stacked: true },
  { x: 214, y: 262, anchor: "start", stacked: false },
  { x: 86, y: 262, anchor: "end", stacked: false },
  { x: 44, y: 104, anchor: "end", stacked: true },
];

interface BrainRadarProps {
  skills: SkillValues;
  /** Lượt trước: chỉ vẽ viền nét đứt để so. */
  previous?: SkillValues;
  /** Hiện chú giải dưới biểu đồ. */
  legend?: boolean;
  /** Nở ra 0,7 giây khi hiện (tắt khi giảm chuyển động). */
  animate?: boolean;
  /** Bản nhỏ: bỏ nhãn trục (dùng cạnh số to). */
  compact?: boolean;
  className?: string;
}

/**
 * Biểu đồ 5 cạnh Kiểm tra não (game-design.md › Kiểm tra não): trục 0–200 tuyến tính, vòng 100
 * (chuẩn) vẽ chấm đậm hơn; vùng vàng = lượt này, nét đứt = lượt trước. Mỗi trục ghi tên + số, không
 * chỉ dựa vào màu. React + SVG, không canvas (bất biến 4). Đặt trong thẻ (chữ màu của thẻ).
 */
export function BrainRadar({
  skills,
  previous,
  legend,
  animate,
  compact,
  className,
}: BrainRadarProps) {
  const { t } = useTranslation();
  const value = (s: SkillValues) => (i: number) => s[CATEGORIES[i] as Category] ?? 0;
  const list = CATEGORIES.map((c) => `${t(`category.${c}`)} ${skills[c] ?? 0}`).join(", ");

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-1.5", className)}>
      <svg
        viewBox={compact ? "40 40 220 220" : "-50 0 400 290"}
        role="img"
        aria-label={t("brainTest.radarLabel", { max: BRAIN_SKILL_MAX, list })}
        className="h-auto w-full"
      >
        <polygon
          points={polygon(() => BRAIN_SKILL_MAX)}
          className="fill-muted stroke-muted-foreground/35"
          strokeWidth={2}
        />
        {RINGS.filter((r) => r < BRAIN_SKILL_MAX).map((ring) => (
          <polygon
            key={ring}
            points={polygon(() => ring)}
            fill="none"
            className={
              ring === BRAIN_SKILL_REFERENCE
                ? "stroke-muted-foreground"
                : "stroke-muted-foreground/35"
            }
            strokeWidth={ring === BRAIN_SKILL_REFERENCE ? 2.5 : 1.5}
            strokeDasharray={ring === BRAIN_SKILL_REFERENCE ? "1 6" : undefined}
            strokeLinecap="round"
          />
        ))}
        <path
          d={CATEGORIES.map((_, i) => {
            const [x, y] = point(i, BRAIN_SKILL_MAX);
            return `M${CX} ${CY} L${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(" ")}
          className="stroke-muted-foreground/35"
          strokeWidth={1.5}
        />
        {previous && (
          <polygon
            points={polygon(value(previous))}
            fill="none"
            className="stroke-current opacity-70"
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinejoin="round"
          />
        )}
        <g
          className={cn(
            "origin-[150px_150px]",
            animate &&
              "motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both",
          )}
        >
          <polygon
            points={polygon(value(skills))}
            className="fill-primary/85 stroke-sticker"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          {CATEGORIES.map((c, i) => {
            const [x, y] = point(i, skills[c] ?? 0);
            return (
              <circle
                key={c}
                cx={x}
                cy={y}
                r={compact ? 7 : 8}
                className={cn(DOT_FILL[c], "stroke-sticker")}
                strokeWidth={3}
              />
            );
          })}
        </g>
        {!compact && (
          <g className="fill-current text-[14px] font-bold">
            {CATEGORIES.map((c, i) => {
              const l = LABELS[i]!;
              const score = (
                <tspan key="score" className="font-display text-[18px] font-extrabold">
                  {skills[c] ?? 0}
                </tspan>
              );
              return l.stacked ? (
                <g key={c}>
                  <text x={l.x} y={l.y} textAnchor={l.anchor}>
                    {t(`category.${c}`)}
                  </text>
                  <text x={l.x} y={l.y + 20} textAnchor={l.anchor}>
                    {score}
                  </text>
                </g>
              ) : (
                <text key={c} x={l.x} y={l.y} textAnchor={l.anchor}>
                  {t(`category.${c}`)} {score}
                </text>
              );
            })}
          </g>
        )}
      </svg>
      {legend && (
        <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4.5 rounded-[4px] border-[2.5px] border-sticker bg-primary" />
            {t("brainTest.legendNow")}
          </span>
          {previous && (
            <span className="flex items-center gap-1.5">
              <span className="w-4.5 border-t-[2.5px] border-dashed border-current" />
              {t("brainTest.legendPrev")}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-4.5 border-t-[3px] border-dotted border-muted-foreground" />
            {t("brainTest.legendRef", { n: BRAIN_SKILL_REFERENCE })}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
