import { normalizeRoomCode } from "@brain-rizz/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createParty, joinParty } from "@/net/connection";
import { IntroScreen } from "./components/IntroScreen";
import { MenuScreen } from "./components/MenuScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { loadProfile, type Profile, saveProfile } from "./profile";

type Step = "intro" | "menu" | "profile";
type PartyAction = (profile: Profile) => Promise<void>;

function codeFromUrl() {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4})/);
  return m?.[1] ? normalizeRoomCode(m[1]) : "";
}

/**
 * Trang chủ khi chưa vào phòng: màn giới thiệu → menu chính ⇄ chọn bạn đồng hành.
 * Mở link mời /r/<mã> thì bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const [initialCode] = useState(codeFromUrl);
  const [step, setStep] = useState<Step>(initialCode ? "menu" : "intro");
  const [profile, setProfile] = useState(loadProfile);
  // Bấm Tạo/Vào phòng khi chưa có tên → điền hồ sơ trước, xong thì làm tiếp việc đang dở.
  const [pending, setPending] = useState<PartyAction | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: PartyAction, p: Profile) {
    setBusy(true);
    try {
      await action(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("connection.failed"));
    } finally {
      setBusy(false);
    }
  }

  function withProfile(action: PartyAction) {
    if (busy) return;
    if (!profile.name.trim()) {
      setPending(() => action);
      setStep("profile");
      return;
    }
    void run(action, profile);
  }

  function confirmProfile(next: Profile) {
    saveProfile(next);
    setProfile(next);
    setStep("menu");
    if (pending) {
      setPending(null);
      void run(pending, next);
    }
  }

  if (step === "intro") return <IntroScreen onStart={() => setStep("menu")} />;

  if (step === "profile") {
    return (
      <ProfileScreen
        profile={profile}
        onBack={() => {
          setPending(null);
          setStep("menu");
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
      onEditProfile={() => setStep("profile")}
      onCreate={() => withProfile((p) => createParty(p))}
      onJoin={(code) => withProfile((p) => joinParty(code, p))}
    />
  );
}
