import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadingWhile } from "@/stores/top-loading.store";

/**
 * Khung xương chung khi đang tải chunk của một màn lười (fallback Suspense trong App): đầu màn
 * (nút quay lại + tiêu đề viết phấn) và vài khối nội dung, kèm thanh tải trên đầu trang.
 * Hiện mờ dần sau một nhịp ngắn để tải nhanh không bị nháy khung (`starting:` — trình duyệt cũ
 * thì hiện ngay; giảm chuyển động thì hiện ngay, không mờ).
 */
export function ScreenSkeleton() {
  const { t } = useTranslation();
  useLoadingWhile(true);
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-1 flex-col gap-3.5 opacity-100 starting:opacity-0 motion-safe:transition-opacity motion-safe:delay-150 motion-safe:duration-300 lg:gap-4.5"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div className="flex items-center gap-4">
        <Skeleton tone="board" className="size-11 shrink-0 rounded-full lg:size-12" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton tone="board" className="h-7.5 w-52 max-w-[70%] lg:h-10 lg:w-72" />
          <Skeleton tone="board" className="h-3.5 w-40 max-w-[55%]" />
        </div>
      </div>
      <div className="grid flex-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6">
        <Skeleton tone="board" className="h-44 rounded-3xl lg:h-auto lg:min-h-72" />
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} tone="board" className="h-12 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
