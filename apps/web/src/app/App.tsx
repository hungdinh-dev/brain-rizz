import type { Phase } from "@brain-rizz/shared";
import { LoaderCircleIcon } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChalkDefs } from "@/components/brand";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { HomeScreen } from "@/features/home";
import { MusicBar, useMusicAutoplay } from "@/features/music";
import { SfxToggle, useSfxEffects } from "@/features/sfx";
import { i18n } from "@/i18n";
import { loadSoloLocales } from "@/i18n/solo";
import { resumeParty } from "@/net/connection";
import { takeOAuthReturnScreen, useAuth } from "@/stores/auth.store";
import { useGame } from "@/stores/game.store";
import { type Screen, useNav } from "@/stores/nav.store";

/*
 * Màn trong phòng party (lobby → … → podium) tải lười thành một chunk, cùng registry minigame
 * (chữ, hình minh hoạ). Tải trước lúc rảnh ở menu để bấm Tạo/Vào phòng là có ngay.
 */
const loadPartyScreens = () => import("./party-screens");
const PartyScreen = lazy(() => loadPartyScreens().then((m) => ({ default: m.PartyScreen })));

/*
 * Các màn một mình và tài khoản (CR-009) tải lười thành chunk riêng để giữ gói đầu ≤ 300 KB gzip
 * (NFR-PERF-01), kèm chữ của các màn đó (i18n/solo.ts). supabase-js cũng tải lười (lib/supabase.ts).
 */
const PracticeScreen = lazy(() =>
  Promise.all([import("@/features/practice"), loadSoloLocales()]).then(([m]) => ({
    default: m.PracticeScreen,
  })),
);
const BrainTestScreen = lazy(() =>
  Promise.all([import("@/features/brain-test"), loadSoloLocales()]).then(([m]) => ({
    default: m.BrainTestScreen,
  })),
);
const AccountScreen = lazy(() =>
  Promise.all([import("@/features/account"), loadSoloLocales()]).then(([m]) => ({
    default: m.AccountScreen,
  })),
);
const LeaderboardScreen = lazy(() =>
  Promise.all([import("@/features/leaderboard"), loadSoloLocales()]).then(([m]) => ({
    default: m.LeaderboardScreen,
  })),
);

const SOLO_SCREENS: Partial<Record<Screen, React.ComponentType>> = {
  practice: PracticeScreen,
  "brain-test": BrainTestScreen,
  account: AccountScreen,
  leaderboard: LeaderboardScreen,
};

/** Pha cần tập trung: ẩn nút ngôn ngữ/theme/nhạc để nhường chỗ, nhạc nền nhỏ lại. */
const FOCUS_PHASES: readonly Phase[] = ["countdown", "playing"];

/** Chọn màn hình theo pha của phòng — app không dùng router. */
export function App() {
  const party = useGame((s) => s.party);
  const screen = useNav((s) => s.screen);
  const soloFocus = useNav((s) => s.soloFocus);
  const phase = party?.phase;
  const SoloScreen = phase ? undefined : SOLO_SCREENS[screen];
  const focused = phase ? FOCUS_PHASES.includes(phase) : !!SoloScreen && soloFocus;

  // Nhạc nền: phát ở thao tác đầu tiên, dừng khi ẩn tab, nhỏ tiếng lúc đếm ngược/đang chơi.
  useMusicAutoplay(focused);
  // Âm thanh hiệu ứng: bấm nút, lỗi server, đúng/sai (vẫn kêu lúc đang chơi dù hàng nút bị ẩn).
  useSfxEffects();

  useEffect(() => {
    // Tải lại trang giữa trận → tự nối lại phòng cũ.
    void resumeParty();
    // Phiên tài khoản đã lưu / quay về từ Google (UC-16).
    useAuth.getState().init();
    if (takeOAuthReturnScreen()) {
      useNav.getState().go("account");
      // Liên kết xong (không có lỗi) → báo một lần khi phiên đã đọc xong.
      const unsubscribe = useAuth.subscribe((s) => {
        if (s.status === "unknown") return;
        unsubscribe();
        if (s.status === "google" && !s.oauthIssue) {
          void loadSoloLocales().then(() => toast(i18n.t("account.linkedToast")));
        }
      });
    }
    // Tải trước chunk màn trong phòng khi trình duyệt rảnh (gói đầu vẫn nhẹ).
    const prefetch = () => void loadPartyScreens().catch(() => {});
    const idle = window.requestIdleCallback?.(prefetch, { timeout: 3_000 });
    const timer = idle === undefined ? window.setTimeout(prefetch, 1_500) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  // Đồng bộ URL /r/<mã> để copy link mời được ngay từ thanh địa chỉ.
  const code = party?.code;
  useEffect(() => {
    if (code && location.pathname !== `/r/${code}`) history.replaceState(null, "", `/r/${code}`);
  }, [code]);

  return (
    // Khung gỗ (nền body) bao quanh mặt bảng phấn; mép dưới dày hơn làm khay phấn.
    <div className="relative h-full p-1.5 pb-4 md:p-3 md:pb-7">
      <div className="chalkboard relative flex h-full flex-col overflow-x-hidden overflow-y-auto rounded-xl bg-background text-foreground">
        <ChalkDefs />
        <div className="safe-area mx-auto flex w-full max-w-6xl flex-1 flex-col">
          {/* Trang chủ tự đặt nút ngôn ngữ/theme/nhạc; lúc đếm ngược và đang chơi thì ẩn */}
          {(phase || SoloScreen) && !focused && (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <MusicBar />
              <SfxToggle />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          )}
          <ConnectionBanner />
          {phase ? (
            <Suspense fallback={<ScreenLoading />}>
              <PartyScreen phase={phase} />
            </Suspense>
          ) : SoloScreen ? (
            <Suspense fallback={<ScreenLoading />}>
              <SoloScreen />
            </Suspense>
          ) : (
            <HomeScreen />
          )}
        </div>
      </div>
      <ChalkTray />
      <Toaster position="bottom-center" />
    </div>
  );
}

/** Đang tải chunk của màn (mạng chậm). */
function ScreenLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-2 text-chalk">
      <LoaderCircleIcon aria-hidden className="size-6 motion-safe:animate-spin" />
      {t("common.loading")}
    </div>
  );
}

/** Mấy viên phấn và cục lau bảng nằm trên khay (chỉ trang trí, ẩn trên điện thoại). */
function ChalkTray() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 hidden md:block">
      <span className="absolute bottom-0 left-[20%] h-2.5 w-12 rounded-full bg-paper" />
      <span className="absolute bottom-0 left-[calc(20%+56px)] h-2.5 w-8 rounded-full bg-pink" />
      <span className="absolute bottom-0 left-[calc(20%+100px)] h-2.5 w-7 rounded-full bg-sun" />
      <span className="absolute right-[22%] bottom-0 h-5 w-24 rounded-md border-t-[6px] border-[#d9cfbd] bg-ink/85" />
    </div>
  );
}
