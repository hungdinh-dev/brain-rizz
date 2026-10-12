import { LoaderCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGame } from "@/stores/game.store";

/**
 * Dải vàng trên cùng báo "đang nối lại" khi rớt mạng giữa chừng (Colyseus tự thử nối lại).
 * Màn hình bên dưới tự khoá thao tác (nút Sẵn sàng, chạm vào minigame) trong lúc này.
 */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const connection = useGame((s) => s.connection);
  const inParty = useGame((s) => s.party !== null);
  if (!inParty || connection !== "reconnecting") return null;
  return (
    <div
      role="status"
      className="mb-2.5 flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground"
    >
      <LoaderCircleIcon aria-hidden className="size-4.5 shrink-0 motion-safe:animate-spin" />
      {t("connection.reconnecting")}
    </div>
  );
}
