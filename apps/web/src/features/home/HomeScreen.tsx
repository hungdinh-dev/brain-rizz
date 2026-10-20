import { normalizeRoomCode } from "@brain-rizz/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { playSfx } from "@/features/sfx";
import { createParty, joinParty } from "@/net/connection";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { IntroScreen } from "./components/IntroScreen";
import { MenuScreen } from "./components/MenuScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { loadProfile, type Profile, saveProfile } from "./profile";

type PartyAction = (profile: Profile) => Promise<void>;

function codeFromUrl() {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4})/);
  return m?.[1] ? normalizeRoomCode(m[1]) : "";
}

/**
 * Trang chủ khi chưa vào phòng: màn giới thiệu → menu chính ⇄ hồ sơ của bạn.
 * Mở link mời /r/<mã> thì bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn (nav.store).
 * Màn hiện tại nằm ở `useNav` để các chế độ một mình (Luyện tập, Kiểm tra não…) quay về được.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const [initialCode] = useState(codeFromUrl);
  const step = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const profileReturn = useNav((s) => s.profileReturn);
  const [profile, setProfile] = useState(loadProfile);
  // Bấm Tạo/Vào phòng, Luyện tập, Kiểm tra não khi chưa có tên → điền hồ sơ trước, xong thì làm
  // tiếp việc đang dở.
  const [pending, setPending] = useState<PartyAction | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: PartyAction, p: Profile) {
    setBusy(true);
    try {
      await action(p);
    } catch (err) {
      playSfx("error");
      toast.error(err instanceof Error ? err.message : t("connection.failed"));
    } finally {
      setBusy(false);
    }
  }

  function withProfile(action: PartyAction) {
    if (busy) return;
    if (!profile.name.trim()) {
      setPending(() => action);
      go("profile");
      return;
    }
    void run(action, profile);
  }

  function confirmProfile(next: Profile) {
    saveProfile(next);
    setProfile(next);
    // Đã có phiên tài khoản thì đồng bộ tên + nhân vật lên bảng xếp hạng (FR-MR-11).
    void useAuth.getState().syncProfile(next);
    go(pending ? "menu" : profileReturn);
    if (pending) {
      setPending(null);
      void run(pending, next);
    }
  }

  if (step === "intro") return <IntroScreen onStart={() => go("menu")} />;

  if (step === "profile") {
    return (
      <ProfileScreen
        profile={profile}
        onBack={() => {
          setPending(null);
          go(profileReturn);
        }}
        onConfirm={confirmProfile}
      />
    );
  }

  return (
    <MenuScreen
      profile={profile}
      initialCode={initialCode}
      busy={busy}
      onEditProfile={() => go("profile")}
      onCreate={() => withProfile((p) => createParty(p))}
      onJoin={(code) => withProfile((p) => joinParty(code, p))}
      onPractice={() => withProfile(async () => go("practice"))}
      onBrainTest={() => withProfile(async () => go("brain-test"))}
      onLeaderboard={() => go("leaderboard")}
      onAccount={() => go("account")}
    />
  );
}
