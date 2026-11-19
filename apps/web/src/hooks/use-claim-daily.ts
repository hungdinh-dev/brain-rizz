import { DAILY_BONUS } from "@brain-rizz/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ProfileForAccount } from "@/stores/auth.store";
import { useWallet } from "@/stores/wallet.store";

/**
 * Nút "Nhận quà hôm nay" (CR-023) ở menu và thẻ Cách kiếm phấn của Máy quay: nhận quà (tạo phiên
 * khách nếu chưa có) rồi báo một toast nhẹ. Không đếm giờ, không nhắc ngày mai (mục 2 kế hoạch).
 * `profile`: tên + bạn đồng hành để ghi hồ sơ cho phiên khách mới (tên rỗng → không ghi).
 */
export function useClaimDaily(profile?: ProfileForAccount) {
  const { t } = useTranslation();
  const claiming = useWallet((s) => s.claiming);
  const name = profile?.name ?? "";
  const avatar = profile?.avatar;
  const claim = useCallback(async () => {
    const outcome = await useWallet
      .getState()
      .claimDaily(name && avatar ? { name, avatar } : undefined);
    if (outcome === "claimed") toast(t("home.menu.gacha.claimedToast", { amount: DAILY_BONUS }));
    else if (outcome === "already") toast(t("home.menu.gacha.alreadyToast"));
    else if (outcome === "offline") toast(t("home.menu.gacha.offlineToast"));
    else if (outcome === "failed") toast(t("home.menu.gacha.errorToast"));
  }, [t, name, avatar]);
  return { claim, claiming };
}
