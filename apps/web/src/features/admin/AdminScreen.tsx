import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile";
import { fetchIsAdmin, fetchRooms } from "@/net/admin-api";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { useAdminStore } from "./admin.store";
import { AdminGate, AdminHeader, AdminNav, type GateKind } from "./components/AdminChrome";
import { SaveBar } from "./components/SaveBar";
import { colorIndexFor } from "./format";
import { type AdminSection, loadLastSection, saveLastSection } from "./sections";
import { AdminsSection } from "./sections/AdminsSection";
import { GamesSection } from "./sections/GamesSection";
import { LoginsSection } from "./sections/LoginsSection";
import { MatchesSection } from "./sections/MatchesSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PlayersSection } from "./sections/PlayersSection";
import { RoomsSection } from "./sections/RoomsSection";
import { ScoringSection } from "./sections/ScoringSection";

/**
 * Trang quản trị (S18, CR-019, ui-ux 6.9) ở `/admin`, tải lười. Cổng trước khi hiện dữ liệu: chưa
 * kết nối Supabase / chưa đăng nhập Google / không có quyền (`is_admin()`). Quyền thật do RLS + RPC
 * và `requireAdmin` của game server quyết định; trang này chỉ hiển thị.
 */
export function AdminScreen() {
  const goBack = useNav((s) => s.goBack);
  const routeSection = useNav((s) => s.route.section);
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.userId);
  const email = useAuth((s) => s.email);
  const lost = useAdminStore((s) => s.lost);
  const [access, setAccess] = useState<GateKind | "ok">("checking");
  const [attempt, setAttempt] = useState(0);
  // Hồ sơ dùng chung (store): tên kéo về từ tài khoản Google hiện ngay.
  const profile = useProfile((s) => s.profile);

  // Rời trang: bỏ bản nháp và số liệu đã tải.
  useEffect(() => () => useAdminStore.getState().reset(), []);

  // Nhớ mục trên đường dẫn ngay cả ở cổng: đăng nhập Google quay về `/admin` vẫn mở đúng mục đó.
  useEffect(() => {
    if (routeSection) saveLastSection(routeSection);
  }, [routeSection]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: kiểm lại khi đổi phiên / bấm Thử lại
  useEffect(() => {
    useAdminStore.setState({ lost: null });
    if (status === "not-configured") return setAccess("offline");
    if (status === "unknown") return setAccess("checking");
    if (status !== "google") return setAccess("signin");
    let live = true;
    setAccess("checking");
    void fetchIsAdmin().then((res) => {
      if (!live) return;
      if (res.ok) setAccess(res.data ? "ok" : "forbidden");
      else if (res.reason === "forbidden") setAccess("forbidden");
      else if (res.reason === "no-session") setAccess("signin");
      else if (res.reason === "not-configured") setAccess("offline");
      else setAccess("error");
    });
    return () => {
      live = false;
    };
  }, [status, userId, attempt]);

  const gate: GateKind | null = lost ?? (access === "ok" ? null : access);
  const back = () => goBack("menu");

  return (
    <div className="@container/root flex flex-1 flex-col gap-3.5">
      <AdminHeader
        identity={
          gate
            ? undefined
            : { email, avatar: profile.avatar, colorIndex: userId ? colorIndexFor(userId) : 0 }
        }
        onBack={back}
      />
      {gate ? (
        <AdminGate
          kind={gate}
          email={email}
          onRetry={() => setAttempt((n) => n + 1)}
          onBack={back}
        />
      ) : (
        <AdminConsole />
      )}
    </div>
  );
}

const SECTION_VIEW: Record<AdminSection, () => React.JSX.Element> = {
  overview: OverviewSection,
  games: GamesSection,
  scoring: ScoringSection,
  logins: LoginsSection,
  players: PlayersSection,
  matches: MatchesSection,
  rooms: RoomsSection,
  admins: AdminsSection,
};

/**
 * Menu + mục đang mở + thanh lưu bản nháp (mục Game, Điểm & hệ số). Mục nằm trên đường dẫn
 * `/admin/<mục>` (CR-022): bấm mục → đẩy lịch sử; `/admin` → mục mở lần trước (replace).
 */
function AdminConsole() {
  const go = useNav((s) => s.go);
  const routeSection = useNav((s) => s.route.section);
  const section: AdminSection = routeSection ?? loadLastSection();
  const roomCount = useAdminStore((s) => s.roomCount);

  useEffect(() => {
    if (!routeSection) go({ screen: "admin", section: loadLastSection() }, { replace: true });
  }, [routeSection, go]);

  useEffect(() => {
    const store = useAdminStore.getState();
    // Cấu hình đang áp dụng: nguồn của bản nháp, chip phiên bản ở Trận đấu / Phòng đang mở.
    void store.loadSettings();
    // Số phòng cho chip ở menu (lỗi thì thôi, mục Phòng đang mở tự báo lỗi).
    void fetchRooms().then((res) => {
      if (res.ok) useAdminStore.getState().setRoomCount(res.data.rooms.length);
    });
  }, []);

  function choose(next: AdminSection) {
    if (next !== section) go({ screen: "admin", section: next });
  }

  const View = SECTION_VIEW[section];
  return (
    <>
      <AdminNav variant="tabs" section={section} roomCount={roomCount} onChange={choose} />
      <div className="grid items-start gap-3 @min-[820px]/root:grid-cols-[224px_minmax(0,1fr)] @min-[820px]/root:gap-5.5">
        <AdminNav variant="side" section={section} roomCount={roomCount} onChange={choose} />
        <main className="@container flex min-w-0 flex-col gap-3.5">
          <View key={section} />
          {(section === "games" || section === "scoring") && <SaveBar />}
        </main>
      </div>
    </>
  );
}
