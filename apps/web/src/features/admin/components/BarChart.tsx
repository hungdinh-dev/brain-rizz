import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAdminFormat } from "../format";
import { niceMax } from "../stats";

export interface BarPoint {
  /** `YYYY-MM-DD`. */
  day: string;
  value: number;
}

/**
 * Biểu đồ cột một chuỗi (mục Tổng quan, ui-ux 6.9): cột `bg-analyze` viền mực bo trên, cột cuối
 * (hôm nay) `bg-primary`; lưới 0 / giữa / đỉnh; nhãn ngày cách 1. Rê chuột / chạm cột hiện thẻ số
 * (mặc định thẻ của hôm nay). Trình đọc màn hình đọc nhãn tóm tắt + danh sách số theo ngày.
 * Vẽ bằng div (không thư viện biểu đồ).
 */
export function BarChart({
  points,
  metricLabel,
}: {
  points: readonly BarPoint[];
  metricLabel: string;
}) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const top = niceMax(Math.max(...values));
  const last = points.length - 1;
  const tip = hover ?? last;
  const dayLabel = (i: number) =>
    i === last ? t("admin.overview.today") : fmt.day(points[i]!.day);
  const grid = [
    { at: 0, value: 0, dashed: false },
    { at: 50, value: top / 2, dashed: true },
    { at: 100, value: top, dashed: true },
  ];

  return (
    <div className="flex flex-col">
      <div
        role="img"
        aria-label={t("admin.overview.chartLabel", {
          metric: metricLabel,
          count: points.length,
          min: fmt.num(Math.min(...values)),
          max: fmt.num(Math.max(...values)),
          today: fmt.num(values[last] ?? 0),
        })}
        className="relative mt-3 mr-4 ml-13 h-[210px]"
      >
        {grid.map((g) => (
          <div
            key={g.at}
            aria-hidden
            className={cn(
              "absolute inset-x-0 border-t border-card-foreground/15",
              g.dashed && "border-dashed",
            )}
            style={{ bottom: `${g.at}%` }}
          >
            <span className="absolute -top-2 -left-12 w-10 text-right text-[11px] text-muted-foreground tabular-nums">
              {fmt.dec(g.value, 1)}
            </span>
          </div>
        ))}
        <div
          aria-hidden
          className="absolute inset-0 flex items-end gap-1 border-b-2 border-sticker"
          onPointerLeave={() => setHover(null)}
        >
          {points.map((p, i) => {
            const height = `${(p.value / top) * 100}%`;
            return (
              <button
                key={p.day}
                type="button"
                tabIndex={-1}
                onPointerEnter={() => setHover(i)}
                onClick={() => setHover(i)}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
              >
                <span
                  className={cn(
                    "block w-full max-w-[26px] rounded-t-[5px] border-2 border-b-0 border-sticker",
                    i === last ? "bg-primary" : "bg-analyze",
                  )}
                  style={{ height }}
                />
                {i === tip && (
                  <span
                    className={cn(
                      "absolute z-[2] rounded-[10px] border-[2.5px] border-sticker bg-card px-2 py-1 text-xs whitespace-nowrap text-card-foreground shadow-[0_3px_0_var(--sticker)]",
                      // Cột sát mép: thẻ số canh vào trong để không tràn khỏi khung (điện thoại).
                      i <= 1 ? "left-0" : i >= last - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                    style={{ bottom: `calc(${height} + 8px)` }}
                  >
                    <b className="tabular-nums">{fmt.num(p.value)}</b> ·{" "}
                    {i === last ? t("admin.overview.todayLower") : fmt.day(p.day)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="mt-1.5 mr-4 ml-13 flex gap-1">
        {points.map((p, i) => (
          <span
            key={p.day}
            className="flex-1 text-center text-[10.5px] whitespace-nowrap text-muted-foreground tabular-nums"
          >
            {(last - i) % 2 === 0 ? dayLabel(i) : ""}
          </span>
        ))}
      </div>
      <ul className="sr-only" aria-label={t("admin.overview.chartList", { metric: metricLabel })}>
        {points.map((p, i) => (
          <li key={p.day}>
            {t("admin.overview.barTip", { value: fmt.num(p.value), day: dayLabel(i) })}
          </li>
        ))}
      </ul>
    </div>
  );
}
