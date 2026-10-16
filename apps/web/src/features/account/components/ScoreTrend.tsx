import { BRAIN_SCORE_MAX } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { useDateFormat } from "@/hooks/use-date-format";
import { useNumberFormat } from "@/hooks/use-number-format";
import type { BrainTestRow } from "@/net/data-api";

/** Số lượt tối đa trên đường tiến bộ (khu 15). */
const MAX_POINTS = 20;
const W = 300;
const H = 110;
const PAD_X = 14;
const PAD_TOP = 22;
const PAD_BOTTOM = 14;

/**
 * Đường tiến bộ Điểm Não (≤ 20 lượt gần nhất, cũ → mới). Một chuỗi nên không cần chú giải; nhãn
 * số ở lượt đầu và lượt cuối, rê/chạm vào điểm có tooltip (thẻ <title>). SVG, không thư viện chart.
 */
export function ScoreTrend({ rows }: { rows: BrainTestRow[] }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();
  const points = rows.slice(0, MAX_POINTS).reverse();
  if (points.length < 2) return null;

  const scores = points.map((p) => p.brainScore);
  // Trục y theo khoảng điểm thật (+ đệm) để thấy rõ tiến bộ, kẹp trong 0–1 000.
  const lo = Math.max(0, Math.min(...scores) - 50);
  const hi = Math.min(BRAIN_SCORE_MAX, Math.max(...scores) + 50);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / (points.length - 1);
  const y = (v: number) => PAD_TOP + ((hi - v) * (H - PAD_TOP - PAD_BOTTOM)) / span;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.brainScore).toFixed(1)}`)
    .join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1">
      <figcaption className="font-display text-base font-extrabold">
        {t("account.progressTitle")}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("account.progressLabel", {
          count: points.length,
          from: fmt(first.brainScore),
          to: fmt(last.brainScore),
        })}
        className="h-auto w-full"
      >
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - PAD_BOTTOM}
          y2={H - PAD_BOTTOM}
          className="stroke-muted-foreground/35"
          strokeWidth={1.5}
        />
        <path
          d={path}
          fill="none"
          className="stroke-current"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.brainScore)}
            r={i === points.length - 1 ? 5.5 : 4}
            className={
              i === points.length - 1 ? "fill-primary stroke-sticker" : "fill-card stroke-current"
            }
            strokeWidth={2}
          >
            <title>{`${date.short(p.createdAt)} · ${fmt(p.brainScore)}`}</title>
          </circle>
        ))}
        <text
          x={x(0)}
          y={y(first.brainScore) - 9}
          textAnchor="start"
          className="fill-muted-foreground text-[11px] font-bold"
        >
          {fmt(first.brainScore)}
        </text>
        <text
          x={x(points.length - 1)}
          y={y(last.brainScore) - 9}
          textAnchor="end"
          className="fill-current font-display text-[13px] font-extrabold"
        >
          {fmt(last.brainScore)}
        </text>
      </svg>
    </figure>
  );
}
