import type { PetId, RoomBotsOption } from "@brain-rizz/shared";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { UnlockCelebration } from "@/features/pets";
import { playSfx } from "@/features/sfx";
import { createParty, joinParty } from "@/net/lazy-connection";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { IntroScreen } from "./components/IntroScreen";
import { MenuScreen } from "./components/MenuScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { type Profile, saveProfile, useProfile } from "./profile";

type PartyAction = (profile: Profile) => Promise<void>;

/**
 * Trang chủ khi chưa vào phòng: màn giới thiệu → menu chính ⇄ hồ sơ của bạn.
 * Mở link mời /r/<mã> thì bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn (nav.store).
 * Màn hiện tại nằm ở `useNav` (đồng bộ đường dẫn `/`, `/profile`, `/r/<mã>`) để các chế độ một mình
 * (Luyện tập, Kiểm tra não…) quay về được.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  // Theo dõi cả khi màn vẫn mở: rời phòng rồi Back/Forward về /r/<mã> thì ô mã điền lại.
  const inviteCode = useNav((s) => s.route.room) ?? "";
  const step = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const goBack = useNav((s) => s.goBack);
  const profileReturn = useNav((s) => s.profileReturn);
  // Hồ sơ mở thay cho màn cần hồ sơ (link sâu): xong thì thay mục lịch sử bằng màn đó.
  const profileRedirect = useNav((s) => s.profileRedirect);
  // Hồ sơ dùng chung (store): hồ sơ kéo về từ tài khoản Google hiện ngay, không cần tải lại trang.
  const profile = useProfile((s) => s.profile);
  const accountRev = useProfile((s) => s.accountRev);
  // Bấm Tạo/Vào phòng, Luyện tập, Kiểm tra não khi chưa có tên → điền hồ sơ trước, xong thì làm
  // tiếp việc đang dở.
  const [pending, setPending] = useState<PartyAction | null>(null);
  // Xong hồ sơ: việc dở chờ chạy khi đã về menu. Quay lại menu bằng `history.back()` thì màn đổi ở
  // `popstate` (chậm một nhịp), nên chạy tiếp ở effect dưới chứ không chạy ngay.
  const [resume, setResume] = useState<{ action: PartyAction; profile: Profile } | null>(null);
  const [busy, setBusy] = useState(false);

  // Rời màn hồ sơ không qua nút Xong (Back của trình duyệt) → bỏ việc đang dở.
  useEffect(() => {
    if (step !== "profile") setPending(null);
  }, [step]);

  const run = useCallback(
    async (action: PartyAction, p: Profile) => {
      setBusy(true);
      try {
        await action(p);
      } catch (err) {
        playSfx("error");
        toast.error(err instanceof Error ? err.message : t("connection.failed"));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!resume) return;
    if (step === "menu") {
      setResume(null);
      void run(resume.action, resume.profile);
    } else if (step !== "profile") {
      // Về màn khác (Back/Forward chen vào) → bỏ việc dở, không chạy lúc lạc về menu sau này.
      setResume(null);
    }
  }, [resume, step, run]);

  function withProfile(action: PartyAction) {
    if (busy) return;
    if (!profile.name.trim()) {
      setPending(() => action);
      go("profile");
      return;
    }
    void run(action, profile);
  }

  /**
   * "Chơi với máy" (CR-016): lỗi để hộp thoại tự hiện (khung lỗi + Thử lại), không toast.
   * Chưa có tên thì điền hồ sơ trước như Tạo phòng, xong thì tạo phòng kèm bot.
   */
  async function playBots(bots: RoomBotsOption, signal: AbortSignal) {
    if (busy) return;
    if (!profile.name.trim()) {
      setPending(() => (p: Profile) => createParty(p, { bots }));
      go("profile");
      return;
    }
    setBusy(true);
    try {
      await createParty(profile, { bots, signal });
    } finally {
      setBusy(false);
    }
  }

  function confirmProfile(next: Profile) {
    // Đổi tên tay: tên này thắng tên trên tài khoản ở lần đồng bộ kế tiếp (kể cả khi lần này lỗi mạng).
    const edited = next.name !== profile.name;
    saveProfile(next);
    // Đã có phiên tài khoản thì đồng bộ tên + nhân vật lên bảng xếp hạng (FR-MR-11).
    void useAuth.getState().syncProfile(next, { edited });
    if (pending) {
      // /profile được đẩy trên mục menu (`/` hoặc `/r/<mã>`): quay lại đúng mục đó, không thay
      // /profile bằng một mục `/` thứ hai (Back đầu tiên sẽ như không làm gì). Về tới menu thì làm
      // tiếp việc đang dở (vào phòng, Luyện tập…).
      setPending(null);
      setResume({ action: pending, profile: next });
      goBack("menu", { replace: true });
    } else if (profileRedirect) {
      go(profileReturn, { replace: true });
    } else {
      goBack(profileReturn);
    }
  }

  /** "Chọn X làm bạn đồng hành" ở hộp chúc mừng mở thú mới (CR-024). */
  function choosePet(pet: PetId) {
    const next = { ...profile, avatar: pet };
    saveProfile(next);
    void useAuth.getState().syncProfile(next);
    toast(t("pets.picked", { name: t(`characters.${pet}.name`) }), { duration: 2_200 });
  }

  if (step === "intro") return <IntroScreen onStart={() => go("menu")} />;

  if (step === "profile") {
    return (
      <ProfileScreen
        // Hồ sơ tài khoản về tới khi đang ở màn này → điền lại ô tên / nhân vật theo tài khoản.
        key={accountRev}
        profile={profile}
        onBack={() => {
          setPending(null);
          if (profileRedirect) go("menu", { replace: true });
          else goBack(profileReturn);
        }}
        onConfirm={confirmProfile}
      />
    );
  }

  return (
    <>
      <MenuScreen
        profile={profile}
        inviteCode={inviteCode}
        busy={busy}
        onEditProfile={() => go("profile")}
        onCreate={() => withProfile((p) => createParty(p))}
        onJoin={(code) => withProfile((p) => joinParty(code, p))}
        onPractice={() => withProfile(async () => go("practice"))}
        onBrainTest={() => withProfile(async () => go("brain-test"))}
        onLeaderboard={() => go("leaderboard")}
        onAccount={() => go("account")}
        onPlayBots={playBots}
      />
      {/* Thú vừa mở khoá (so với danh sách đã thấy trên máy) → hộp chúc mừng, lần lượt từng con. */}
      <UnlockCelebration onChoose={choosePet} />
    </>
  );
}
