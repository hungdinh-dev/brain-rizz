import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Thời gian nút hiện "Đã chép!" (ms). */
const COPIED_MS = 1600;

interface RoomCodePanelProps {
  code: string;
  /** Nút "Mời bạn" đặt cạnh nút Sao chép (bản máy tính) */
  invite?: ReactNode;
  className?: string;
}

/**
 * Mã phòng viết phấn trong khung nét đứt, nút ẩn/hiện (•••• khi chiếu màn hình hoặc stream)
 * và nút sao chép mã. Ẩn/hiện chỉ có tác dụng trên máy của mình.
 */
export function RoomCodePanel({ code, invite, className }: RoomCodePanelProps) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Trình duyệt chặn clipboard (http, iframe…) → ít nhất cho người dùng thấy mã để tự chép.
      setHidden(false);
      toast(code);
    }
  }

  return (
    <div
      className={cn(
        "flex h-18.5 items-center gap-2 rounded-[18px] border-[3px] border-dashed border-chalk/55 pr-2.5 pl-3.5 lg:h-20 lg:gap-2.5 lg:rounded-[20px] lg:pr-3.5 lg:pl-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col leading-none lg:min-w-49">
        <span className="text-[11px] font-bold tracking-[2px] text-chalk-muted uppercase lg:text-xs">
          {t("lobby.roomCode")}
        </span>
        <span
          // Nét phấn sần: dùng lại filter SVG #chalk khai báo trong <ChalkDefs /> của App.
          className="mt-1 filter-[url(#chalk)] font-display text-[38px] font-extrabold tracking-[6px] text-chalk lg:text-[50px] lg:tracking-[10px]"
        >
          {hidden ? "••••" : code}
        </span>
      </div>
      <Button
        variant="chalk"
        size="icon-chalk"
        className="lg:size-12"
        aria-label={hidden ? t("lobby.showCode") : t("lobby.hideCode")}
        aria-pressed={hidden}
        onClick={() => setHidden((h) => !h)}
      >
        {hidden ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
      </Button>
      <Button
        variant="outline"
        className="min-h-11 px-3 text-base lg:min-h-12 lg:min-w-33 lg:px-4 lg:text-lg"
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        <span aria-live="polite">{copied ? t("lobby.copied") : t("lobby.copy")}</span>
      </Button>
      {invite}
    </div>
  );
}
