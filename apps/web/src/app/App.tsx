import { isChatPhase, type Phase } from "@brain-rizz/shared";
import { lazy, Suspense, useEffect } from "react";
import { toast } from "sonner";
import { ChalkDefs } from "@/components/brand";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { ScreenSkeleton } from "@/components/common/ScreenSkeleton";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { TopLoadingBar } from "@/components/common/TopLoadingBar";
import { Toaster } from "@/components/ui/sonner";
import { HomeScreen } from "@/features/home";
import { MotionToggle } from "@/features/motion";
import { MusicBar, useMusicAutoplay } from "@/features/music";
import { SfxToggle, useSfxEffects } from "@/features/sfx";
import { i18n } from "@/i18n";
import { loadAdminLocales } from "@/i18n/admin";
import { loadGachaLocales } from "@/i18n/gacha";
import { loadSoloLocales } from "@/i18n/solo";
import { cn } from "@/lib/utils";
import { resumeParty } from "@/net/lazy-connection";
import { takeOAuthReturnScreen, useAuth } from "@/stores/auth.store";
import { useGame } from "@/stores/game.store";
import { enterRoomEntry, pathForScreen, type Screen, useNav } from "@/stores/nav.store";

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

/*
 * Máy quay phụ kiện (CR-023): chunk riêng kèm chữ 24 món / độ hiếm (i18n/gacha.ts). Tủ đồ đã gộp
 * vào trang Hồ sơ (`/profile/accessories`), tab Phụ kiện tự tải lười trong ProfileScreen.
 */
const GachaScreen = lazy(() =>
  Promise.all([import("@/features/gacha"), loadGachaLocales()]).then(([m]) => ({
    default: m.GachaScreen,
  })),
);

/*
 * Trang quản trị `/admin` (CR-019): chunk riêng kèm chữ của trang (i18n/admin.ts); người chơi
 * thường không bao giờ tải. Có thanh trên riêng nên không hiện hàng nút nhạc/ngôn ngữ chung.
 */
const AdminScreen = lazy(() =>
  Promise.all([import("@/features/admin"), loadAdminLocales()]).then(([m]) => ({
    default: m.AdminScreen,
  })),
);

const SOLO_SCREENS: Partial<Record<Screen, React.ComponentType>> = {
  practice: PracticeScreen,
  "brain-test": BrainTestScreen,
  account: AccountScreen,
  leaderboard: LeaderboardScreen,
  gacha: GachaScreen,
};

/** Pha cần tập trung: ẩn nút ngôn ngữ/theme/nhạc để nhường chỗ, nhạc nền nhỏ lại. */
const FOCUS_PHASES: readonly Phase[] = ["countdown", "playing"];

/**
 * Chọn màn hình theo pha của phòng; ngoài phòng theo `useNav` (đường dẫn đồng bộ bằng History API,
 * không dùng thư viện router — CR-022).
 */
export function App() {
  const party = useGame((s) => s.party);
  const screen = useNav((s) => s.screen);
  const soloFocus = useNav((s) => s.soloFocus);
  const phase = party?.phase;
  const admin = !phase && screen === "admin";
  const SoloScreen = phase ? undefined : SOLO_SCREENS[screen];
  const focused = phase ? FOCUS_PHASES.includes(phase) : !!SoloScreen && soloFocus;
  // Máy tính, pha có chat (CR-011): nới khung thêm đúng bề rộng cột chat (320 px + khoảng cách).
  const chatColumn = !!phase && isChatPhase(phase);

  // Nhạc nền: phát ở thao tác đầu tiên, dừng khi ẩn tab, nhỏ tiếng lúc đếm ngược/đang chơi
  // và ở trang quản trị (công cụ làm việc).
  useMusicAutoplay(focused || admin);
  // Âm thanh hiệu ứng: bấm nút, lỗi server, đúng/sai (vẫn kêu lúc đang chơi dù hàng nút bị ẩn).
  useSfxEffects();

  useEffect(() => {
    // Tải lại trang giữa trận → tự nối lại phòng cũ. StrictMode chạy effect này hai lần: cả
    // `resumeParty` và `init` dùng chung lần gọi đầu (token nối lại chỉ dùng được một lần).
    void resumeParty();
    // Phiên tài khoản đã lưu / quay về từ Google (UC-16).
    void useAuth.getState().init();
    if (takeOAuthReturnScreen()) {
      // Chuyển hướng `/` → `/account` (replace, giữ `?code=` cho supabase-js đổi lấy phiên).
      useNav.getState().go("account", { replace: true });
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

  // Trong phòng: URL /r/<mã> (copy link mời được ngay từ thanh địa chỉ), một mục lịch sử riêng để
  // Back hỏi "Rời phòng?" thay vì rời trang (CR-022). Không tách theo pha.
  const code = party?.code;
  useEffect(() => {
    if (code) enterRoomEntry(code, pathForScreen({ screen: "menu", room: code }));
  }, [code]);

  return (
    // Khung gỗ (nền body) bao quanh mặt bảng phấn; mép dưới dày hơn làm khay phấn.
    <div className="relative h-full p-1.5 pb-4 md:p-3 md:pb-7">
      <div className="chalkboard relative flex h-full flex-col overflow-x-hidden overflow-y-auto rounded-xl bg-background text-foreground">
        <ChalkDefs />
        <div
          className={cn(
            "safe-area mx-auto flex w-full max-w-6xl flex-1 flex-col",
            chatColumn && "lg:max-w-[calc(72rem+21.25rem)]",
            // Trang quản trị: bảng nhiều cột, dùng gần hết bề rộng màn máy tính.
            admin && "max-w-[90rem]",
          )}
        >
          {/* Trang chủ tự đặt nút ngôn ngữ/theme/nhạc; lúc đếm ngược và đang chơi thì ẩn */}
          {(phase || SoloScreen) && !focused && (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <MusicBar />
              <SfxToggle />
              <MotionToggle />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          )}
          <ConnectionBanner />
          {phase ? (
            <Suspense fallback={<ScreenSkeleton />}>
              <PartyScreen phase={phase} />
            </Suspense>
          ) : SoloScreen ? (
            <Suspense fallback={<ScreenSkeleton />}>
              <SoloScreen />
            </Suspense>
          ) : admin ? (
            <Suspense fallback={<ScreenSkeleton />}>
              <AdminScreen />
            </Suspense>
          ) : (
            <HomeScreen />
          )}
        </div>
      </div>
      <ChalkTray />
      {/* Thanh tải mảnh trên đầu trang: chunk màn lười (fallback ScreenSkeleton) và dữ liệu Supabase */}
      <TopLoadingBar />
      <Toaster position="bottom-center" />
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
