import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScreenHeaderProps {
  title: string;
  /** Dòng phụ dưới tiêu đề (viết phấn). */
  subtitle?: ReactNode;
  /** Nút tròn quay lại; nhãn mặc định "Về menu". */
  onBack?(): void;
  backLabel?: string;
  /** Phần bên phải (tab, công tắc kỳ…); xuống dòng trên điện thoại. */
  children?: ReactNode;
  className?: string;
}

/** Đầu các màn một mình và tài khoản (khu 13–16): nút quay lại + tiêu đề viết phấn. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  children,
  className,
}: ScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      {onBack && (
        <Button
          variant="chalk"
          size="icon-chalk"
          aria-label={backLabel ?? t("common.backToMenu")}
          data-sfx="back"
          onClick={onBack}
          className="lg:size-12"
        >
          <ChevronLeftIcon className="size-6" strokeWidth={2.6} />
        </Button>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="font-display text-[30px] leading-none font-extrabold text-chalk lg:text-[40px]">
          {title}
        </h1>
        {subtitle && <p className="text-[13px] text-chalk-muted lg:text-[15px]">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
