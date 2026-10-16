import { CloudOffIcon, type LucideIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** Nút dẫn tới việc tiếp theo (vd. "Làm Kiểm tra não") hoặc Thử lại. */
  action?: ReactNode;
  /** `alert` cho lỗi, `status` cho trống / chưa kết nối. */
  role?: "status" | "alert";
  /** Màu ô icon (màu thương hiệu, chữ mực). */
  tone?: string;
  className?: string;
}

/**
 * Trạng thái trống / lỗi / chưa kết nối (khu 17): icon trong ô vuông viền mực, tiêu đề, một câu,
 * một nút. Đặt BÊN TRONG thẻ (chữ dùng màu của thẻ).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  role = "status",
  tone = "bg-paper",
  className,
}: EmptyStateProps) {
  return (
    <section
      role={role}
      className={cn("flex flex-col items-center gap-2.5 px-4 py-6 text-center", className)}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-2xl border-[3px] border-ink text-ink",
          tone,
        )}
      >
        <Icon aria-hidden className="size-7" strokeWidth={2.3} />
      </span>
      <h2 className="font-display text-[22px] leading-tight font-extrabold">{title}</h2>
      {body && <p className="max-w-80 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </section>
  );
}

/** Lý do không có dữ liệu (khớp `DataFailure` của net/data-api, trừ `no-session`). */
export type DataProblem = "not-configured" | "error";

/** "Chưa kết nối máy chủ dữ liệu" hoặc "Không tải được" + nút Thử lại. */
export function DataProblemState({
  problem,
  onRetry,
  className,
}: {
  problem: DataProblem;
  onRetry?(): void;
  className?: string;
}) {
  const { t } = useTranslation();
  const retry = onRetry && (
    <Button variant="outline" onClick={onRetry}>
      <RotateCwIcon aria-hidden />
      {t("common.retry")}
    </Button>
  );
  return problem === "not-configured" ? (
    <EmptyState
      icon={CloudOffIcon}
      tone="bg-sky"
      title={t("common.noDataServer")}
      body={t("common.noDataServerHint")}
      action={retry}
      className={className}
    />
  ) : (
    <EmptyState
      role="alert"
      icon={TriangleAlertIcon}
      tone="bg-pink"
      title={t("common.loadError")}
      body={t("common.loadErrorHint")}
      action={retry}
      className={className}
    />
  );
}
