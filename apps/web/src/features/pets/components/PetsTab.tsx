import { CHARACTER_IDS, type CharacterId } from "@brain-rizz/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { loadProfile, saveProfile } from "@/lib/profile";
import { useAuth } from "@/stores/auth.store";
import { usePetUnlocks } from "../use-pet-unlocks";
import { PetGrid } from "./PetGrid";

/**
 * Tab "Bạn đồng hành" của Tủ đồ (`/wardrobe/pets`, ui-ux 6.12): dòng "Đã mở n/12" + lưới 12 nhân
 * vật. Chọn nhân vật đã mở = lưu ngay vào hồ sơ trên máy (và tài khoản nếu có phiên). Không props:
 * tự đọc / ghi hồ sơ.
 */
export function PetsTab() {
  const { t } = useTranslation();
  const [avatar, setAvatar] = useState(() => loadProfile().avatar);
  const unlocks = usePetUnlocks();
  const openCount = CHARACTER_IDS.filter((id) => id === avatar || unlocks.isUnlocked(id)).length;

  function pick(id: CharacterId) {
    if (id === avatar) return;
    const next = { ...loadProfile(), avatar: id };
    saveProfile(next);
    setAvatar(id);
    void useAuth.getState().syncProfile(next);
    toast(t("pets.picked", { name: t(`characters.${id}.name`) }), { duration: 2_200 });
  }

  return (
    <section className="flex flex-col gap-3 lg:gap-4">
      <p className="text-sm text-chalk-muted lg:text-[15px]">
        {t("pets.unlockedCount", { count: openCount, total: CHARACTER_IDS.length })}{" "}
        {t("pets.unlockedNote")}
      </p>
      <PetGrid layout="wardrobe" value={avatar} onPick={pick} />
    </section>
  );
}
