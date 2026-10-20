import { ClientMessage } from "@brain-rizz/shared";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";
import { useGame } from "@/stores/game.store";

/** Cờ `chatEnabled` của phòng (server giữ, chủ phòng đổi). Phòng chưa có cờ → coi như bật. */
export function useChatEnabled(): boolean {
  return useGame((s) => s.party?.chatEnabled ?? true);
}

function setChatEnabled(enabled: boolean) {
  send(ClientMessage.SetChatEnabled, { enabled });
}

/**
 * Công tắc gọn ở tiêu đề khung chat, chỉ chủ phòng thấy (CR-011). Kèm chữ "Bật"/"Tắt" để trạng
 * thái không chỉ báo bằng màu.
 */
export function ChatEnabledSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  return (
    <span className={cn("flex items-center gap-2.5 pr-1", className)}>
      <span aria-hidden className="text-[13px] font-bold">
        {enabled ? t("chat.on") : t("chat.off")}
      </span>
      <Switch
        checked={enabled}
        aria-label={t("chat.switchLabel")}
        onCheckedChange={setChatEnabled}
      />
    </span>
  );
}

/** Hàng "Chat trong phòng" trong thẻ Thiết lập trận của chủ phòng (CR-011). */
export function ChatSettingRow({ className }: { className?: string }) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  const id = useId();
  const hintId = useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label htmlFor={id} className="text-[15px] font-bold">
          {t("chat.setting")}
        </Label>
        <span id={hintId} className="text-[13px] leading-snug text-muted-foreground">
          {enabled ? t("chat.settingHintOn") : t("chat.settingHintOff")}
        </span>
      </span>
      <span aria-hidden className="text-[13px] font-bold">
        {enabled ? t("chat.on") : t("chat.off")}
      </span>
      <Switch
        id={id}
        checked={enabled}
        aria-describedby={hintId}
        onCheckedChange={setChatEnabled}
        className="mr-1"
      />
    </div>
  );
}
