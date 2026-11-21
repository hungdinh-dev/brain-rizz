import {
  CATEGORIES,
  type Category,
  type CosmeticId,
  type Difficulty,
  type GameId,
  isDifficulty,
  isGameId,
  normalizeRoomCode,
} from "@brain-rizz/shared";
import { create } from "zustand";

/**
 * Điều hướng ngoài phòng party và đồng bộ thanh địa chỉ bằng History API (CR-022), không dùng thư
 * viện router. Bản đồ URL: docs/01-product/practice-favorites-howto-routes.md mục 3.4.
 *
 * - Người dùng chuyển màn → `pushState`; sửa đường dẫn sai / chuyển hướng → `replaceState`.
 * - Luyện tập có thêm tham số: `/practice?cat=<nhóm|fav>` (lọc lưới chọn game), `/practice/<game>?d=<0–3>`
 *   (mức tối thiểu chọn sẵn). Giá trị lạ bị bỏ bằng replace; tham số khác (vd. `?code=`) giữ nguyên.
 * - Back/Forward (`popstate`) → đổi màn, không đẩy thêm lịch sử. Màn đang chơi / đang trong phòng
 *   chặn được Back (`setBackGuard`) để hỏi trước, rồi đẩy lại mục vừa rời (`restoreEntry`).
 * - Trong phòng giữ một URL, không tách theo pha (pha do server quyết): party `/r/<mã>`, Kiểm tra
 *   não `/brain-test`. Vào phòng thì đẩy một mục "phòng" (`enterRoomEntry`) để Back còn chặn được.
 */
export type Screen =
  | "intro"
  | "menu"
  | "profile"
  | "practice"
  | "brain-test"
  | "account"
  | "leaderboard"
  | "admin"
  | "gacha";

/**
 * Tab của trang Hồ sơ (đã gộp Tủ đồ): `/profile` = Bạn đồng hành, `/profile/accessories` = Phụ kiện.
 * Link cũ `/wardrobe` → `/profile/accessories`, `/wardrobe/pets` → `/profile` (replace).
 */
export type ProfileTab = "pets" | "accessories";

/** 8 mục của trang quản trị (ui-ux 6.9) theo thứ tự menu, cũng là `<mục>` trong `/admin/<mục>`. */
export const ADMIN_SECTIONS = [
  "overview",
  "games",
  "scoring",
  "logins",
  "players",
  "matches",
  "rooms",
  "admins",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function isAdminSection(value: unknown): value is AdminSection {
  return typeof value === "string" && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

/** Lọc ở lưới chọn game Luyện tập (`/practice?cat=`): một nhóm, hoặc `fav` = Yêu thích (CR-020). */
export type PracticeFilter = Category | "fav";

export function isPracticeFilter(value: unknown): value is PracticeFilter {
  return (
    value === "fav" ||
    (typeof value === "string" && (CATEGORIES as readonly string[]).includes(value))
  );
}

/** Màn + tham số trên đường dẫn. */
export interface Route {
  screen: Screen;
  /** `/practice/<gameId>` (hướng dẫn game đó), `/leaderboard/<gameId>` (bảng theo game). */
  gameId?: GameId;
  /**
   * `/practice?cat=<nhóm|fav>`: lưới chọn game lọc sẵn (nút "Luyện ngay" của thú khoá theo nhóm;
   * đổi chip thì thay mục lịch sử). Bỏ trống = Tất cả. Chỉ đi với `/practice` (không có `gameId`).
   */
  filter?: PracticeFilter;
  /**
   * `/practice/<gameId>?d=<0–3>`: mức tối thiểu chọn sẵn ở màn hướng dẫn lần này (nút "Luyện ngay"
   * của thú cần "Thường trở lên"). Mức đang nhớ thấp hơn thì nâng lên; không ghi gì vào kỷ lục.
   */
  level?: Difficulty;
  /** `/admin/<mục>`. */
  section?: AdminSection;
  /** Menu mở từ link mời `/r/<mã>` (mã điền sẵn). */
  room?: string;
  /** `/profile/accessories` → `"accessories"`; bỏ trống = tab Bạn đồng hành. */
  tab?: ProfileTab;
  /**
   * Nút "Mặc thử" ở màn mở quà: món đeo thử ngay ở tab Phụ kiện của Hồ sơ, mở đúng chỗ của món. Chỉ
   * trong bộ nhớ, không lên đường dẫn (tải lại trang thì thôi).
   */
  tryOn?: CosmeticId;
}

/** Màn cần hồ sơ (tên + bạn đồng hành) trước khi vào, như nút ở menu. */
const PROFILE_SCREENS: readonly Screen[] = ["practice", "brain-test"];

const HOME: Route = { screen: "intro" };

/**
 * Tham số truy vấn thuộc nav (`?cat=`, `?d=`): đọc / sửa theo bản đồ URL. Tham số khác (vd. `?code=`
 * khi quay về từ Google) không phải của nav: thay mục lịch sử thì giữ nguyên cho supabase-js.
 */
const NAV_PARAMS: readonly string[] = ["cat", "d"];

function parseLevel(raw: string | null): Difficulty | undefined {
  if (raw === null || !/^\d$/.test(raw)) return undefined;
  const level = Number(raw);
  return isDifficulty(level) ? level : undefined;
}

/**
 * Đường dẫn (có thể kèm `?truy-vấn`, `#hash`) → màn + tham số (hàm thuần, có test). Không phân biệt
 * hoa thường, bỏ qua `/` thừa. `gameId` / mục lạ → màn cha (`/practice`, `/leaderboard`, `/admin`);
 * đường dẫn lạ → `/`. Tham số lạ (`?cat=` không phải nhóm, `?d=` ngoài 0–3, tham số sai màn) bị bỏ.
 */
export function screenForPath(path: string): Route {
  const beforeHash = path.split("#", 1)[0] ?? "";
  const q = beforeHash.indexOf("?");
  const pathname = q < 0 ? beforeHash : beforeHash.slice(0, q);
  const query = new URLSearchParams(q < 0 ? "" : beforeHash.slice(q));
  const [head = "", param, ...rest] = pathname.split("/").filter(Boolean);
  if (rest.length > 0) return HOME;
  const arg = param?.toLowerCase();
  switch (head.toLowerCase()) {
    case "":
      return HOME;
    case "r":
      // Link mời /r/<mã> → bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn.
      return param && /^[a-z0-9]{4}$/i.test(param)
        ? { screen: "menu", room: normalizeRoomCode(param) }
        : HOME;
    case "practice": {
      if (isGameId(arg)) {
        const level = parseLevel(query.get("d"));
        return level === undefined
          ? { screen: "practice", gameId: arg }
          : { screen: "practice", gameId: arg, level };
      }
      const filter = param === undefined ? query.get("cat")?.toLowerCase() : undefined;
      return isPracticeFilter(filter) ? { screen: "practice", filter } : { screen: "practice" };
    }
    case "leaderboard":
      return isGameId(arg) ? { screen: "leaderboard", gameId: arg } : { screen: "leaderboard" };
    case "admin":
      return isAdminSection(arg) ? { screen: "admin", section: arg } : { screen: "admin" };
    case "profile":
      // Tab lạ → tab Bạn đồng hành (như game lạ → màn cha).
      return arg === "accessories"
        ? { screen: "profile", tab: "accessories" }
        : { screen: "profile" };
    case "brain-test":
      return param === undefined ? { screen: "brain-test" } : HOME;
    case "account":
      return param === undefined ? { screen: "account" } : HOME;
    case "gacha":
      return param === undefined ? { screen: "gacha" } : HOME;
    case "wardrobe":
      // Tủ đồ cũ đã gộp vào Hồ sơ: giữ link cũ (mở trang thì đường dẫn được sửa bằng replace).
      return arg === "pets" ? { screen: "profile" } : { screen: "profile", tab: "accessories" };
    default:
      return HOME;
  }
}

/**
 * Màn + tham số → đường dẫn chuẩn, kèm `?cat=` / `?d=` của Luyện tập (hàm thuần, có test). Giới
 * thiệu và menu cùng là `/`.
 */
export function pathForScreen(route: Route): string {
  switch (route.screen) {
    case "intro":
      return "/";
    case "menu":
      return route.room ? `/r/${route.room}` : "/";
    case "practice":
      if (route.gameId) {
        return route.level === undefined
          ? `/practice/${route.gameId}`
          : `/practice/${route.gameId}?d=${route.level}`;
      }
      return route.filter ? `/practice?cat=${route.filter}` : "/practice";
    case "leaderboard":
      return route.gameId ? `/leaderboard/${route.gameId}` : "/leaderboard";
    case "admin":
      return route.section ? `/admin/${route.section}` : "/admin";
    case "profile":
      return route.tab === "accessories" ? "/profile/accessories" : "/profile";
    default:
      return `/${route.screen}`;
  }
}

/** Dữ liệu app gắn vào mỗi mục lịch sử (`history.state`). */
interface EntryState {
  /** Thứ tự mục trong lịch sử (để biết mục trước là màn nào khi bấm nút quay lại trong app). */
  idx?: number;
  /** `/` đang là menu, không phải màn giới thiệu. */
  menu?: boolean;
  /** Mục của một phòng (party: mã phòng; Kiểm tra não: `brain`). */
  room?: string;
  /** `/profile`: đường dẫn quay về sau khi xong hồ sơ. */
  next?: string;
  /** `/profile` mở thay cho màn cần hồ sơ (link sâu): xong thì thay mục này bằng `next`. */
  redirect?: boolean;
}

function readState(raw: unknown): EntryState {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  const state: EntryState = {};
  if (typeof s.idx === "number" && Number.isInteger(s.idx) && s.idx >= 0) state.idx = s.idx;
  if (s.menu === true) state.menu = true;
  if (typeof s.room === "string") state.room = s.room;
  if (typeof s.next === "string") state.next = s.next;
  if (s.redirect === true) state.redirect = true;
  return state;
}

function sameState(a: EntryState, b: EntryState): boolean {
  return (
    a.idx === b.idx &&
    a.menu === b.menu &&
    a.room === b.room &&
    a.next === b.next &&
    a.redirect === b.redirect
  );
}

/** Màn của một mục lịch sử: như `screenForPath`, riêng `/` có dấu `menu` thì là menu. */
function routeForEntry(path: string, state: EntryState): Route {
  const route = screenForPath(path);
  return route.screen === "intro" && state.menu ? { screen: "menu" } : route;
}

/** Các phần `k=v` của `location.search`, chia theo tham số của nav hay không (giữ nguyên mã hoá). */
function searchParts(): { nav: string[]; other: string[] } {
  const nav: string[] = [];
  const other: string[] = [];
  for (const part of location.search.replace(/^\?/, "").split("&")) {
    if (!part) continue;
    const key = (part.split("=", 1)[0] ?? "").toLowerCase();
    (NAV_PARAMS.includes(key) ? nav : other).push(part);
  }
  return { nav, other };
}

/** Đường dẫn đang ở, chỉ kèm tham số của nav: so với `pathForScreen` để biết cần đẩy / sửa. */
function locationPath(): string {
  const { nav } = searchParts();
  return nav.length > 0 ? `${location.pathname}?${nav.join("&")}` : location.pathname;
}

/** Thay mục: đường dẫn chuẩn + tham số không phải của nav (`?code=` cho supabase-js) + `#hash`. */
function withKeptSearch(path: string): string {
  const { other } = searchParts();
  const search = other.length > 0 ? `${path.includes("?") ? "&" : "?"}${other.join("&")}` : "";
  return path + search + location.hash;
}

/** Màn quay về sau khi xong hồ sơ (đọc từ `next`); mặc định menu. */
function returnRoute(next: string | undefined): Route {
  const route = next ? routeForEntry(next, { menu: true }) : HOME;
  return route.screen === "intro" || route.screen === "profile" ? { screen: "menu" } : route;
}

/**
 * Khoá so sánh hai mục: menu (có hay không có mã mời) coi là một; tham số `?cat=` / `?d=` không
 * tính ("Chọn game khác" quay lại đúng mục lưới Luyện tập, giữ lọc đang chọn).
 */
function keyOf(route: Route): string {
  if (route.screen === "menu") return "menu";
  const [pathname] = pathForScreen(route).split("?", 1);
  return `${route.screen}|${pathname}`;
}

function toRoute(to: Screen | Route): Route {
  return typeof to === "string" ? { screen: to } : to;
}

function profileEntry(profileReturn: Route, redirect: boolean): EntryState {
  return redirect
    ? { next: pathForScreen(profileReturn), redirect: true }
    : { next: pathForScreen(profileReturn) };
}

/** Chặn Back/Forward: trả `true` = đã xử lý (vd. mở hộp xác nhận), nav không đổi màn. */
export type BackGuard = (target: Route) => boolean;

let index = 0;
/** Khoá màn của các mục đã biết trong lần tải trang này, theo `idx`. */
let keys: (string | undefined)[] = [];
let current: { path: string; state: EntryState } | null = null;
/** Mục vừa rời khi Back bị chặn: `restoreEntry()` đẩy lại. */
let blocked: { path: string; state: EntryState } | null = null;
let backGuard: BackGuard | null = null;
let hasProfile: () => boolean = () => true;

function canUseHistory() {
  return typeof location !== "undefined" && typeof history !== "undefined";
}

function needsProfile(route: Route) {
  return PROFILE_SCREENS.includes(route.screen) && !hasProfile();
}

/**
 * Ghi một mục lịch sử. Thay mục (`replace`) thì giữ tham số không phải của nav và `#hash` (quay về
 * từ Google còn `?code=`); tham số của nav lấy theo đường dẫn chuẩn (giá trị lạ bị bỏ).
 */
function commit(mode: "push" | "replace", path: string, extra: EntryState, key: string) {
  const idx = mode === "push" ? index + 1 : index;
  const state: EntryState = { ...extra, idx };
  if (mode === "push") {
    history.pushState(state, "", path);
    keys.length = idx;
  } else if (path !== locationPath() || !sameState(readState(history.state), state)) {
    history.replaceState(state, "", withKeptSearch(path));
  }
  index = idx;
  keys[idx] = key;
  current = { path, state };
}

/** Ghi mục cho một màn. Đẩy đúng đường dẫn đang ở (vd. giới thiệu → menu, cùng `/`) → thay mục. */
function write(mode: "push" | "replace", route: Route, extra: EntryState = {}) {
  if (!canUseHistory()) return;
  const path = pathForScreen(route);
  const push = mode === "push" && path !== locationPath();
  const state = route.screen === "menu" ? { ...extra, menu: true } : extra;
  commit(push ? "push" : "replace", path, state, keyOf(route));
}

/** Đặt màn theo một mục lịch sử (lúc mở trang, Back/Forward): chuyển hướng / sửa đường dẫn bằng replace. */
function apply(target: Route, state: EntryState) {
  let route = target;
  let profileReturn: Route = { screen: "menu" };
  let profileRedirect = false;
  if (needsProfile(route)) {
    // Link sâu khi chưa có hồ sơ → chọn bạn đồng hành trước, xong thì về đúng màn này.
    profileReturn = route;
    profileRedirect = true;
    route = { screen: "profile" };
    write("replace", route, profileEntry(profileReturn, true));
  } else {
    if (route.screen === "profile") {
      profileReturn = returnRoute(state.next);
      profileRedirect = !!state.redirect;
    }
    // Sửa đường dẫn lạ / thêm `idx` cho mục mở đầu; giữ dấu phòng, đích quay về của hồ sơ.
    const { idx: _idx, menu: _menu, ...extra } = state;
    write("replace", route, extra);
  }
  useNav.setState({
    route,
    screen: route.screen,
    soloFocus: false,
    profileReturn,
    profileRedirect,
  });
}

function onPopState() {
  const left = current;
  const state = readState(history.state);
  if (state.idx !== undefined) index = state.idx;
  const path = locationPath();
  const target = routeForEntry(path, state);
  keys[index] = keyOf(target);
  current = { path, state };
  // Nhớ mục vừa rời trước khi hỏi guard (guard có thể `restoreEntry()` ngay). Bấm Back nhiều lần khi
  // hộp xác nhận đang mở: vẫn nhớ mục ban đầu.
  blocked ??= left;
  if (backGuard?.(target)) return;
  blocked = null;
  apply(target, state);
}

/**
 * Khởi động điều hướng (một lần, trước khi render): đọc màn từ đường dẫn, chuyển hướng link sâu khi
 * chưa có hồ sơ, sửa đường dẫn lạ (replace), nghe `popstate`. Trả hàm gỡ (cho test).
 */
export function initNav(options: { hasProfile?(): boolean } = {}): () => void {
  if (options.hasProfile) hasProfile = options.hasProfile;
  if (!canUseHistory()) return () => {};
  const state = readState(history.state);
  index = state.idx ?? 0;
  keys = [];
  blocked = null;
  const path = locationPath();
  current = { path, state };
  apply(routeForEntry(path, state), state);
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}

/** Màn đang chơi / trong phòng chặn Back. Trả hàm gỡ (chỉ gỡ khi vẫn là chính guard này). */
export function setBackGuard(guard: BackGuard): () => void {
  backGuard = guard;
  return () => {
    if (backGuard === guard) backGuard = null;
  };
}

/** Back bị chặn rồi người dùng chọn ở lại → đẩy lại mục vừa rời (URL về như cũ, màn không đổi). */
export function restoreEntry() {
  if (!blocked || !canUseHistory()) return;
  const { path, state } = blocked;
  blocked = null;
  commit("push", path, state, keyOf(routeForEntry(path, state)));
}

/**
 * Vào phòng (party: mã phòng; Kiểm tra não: `brain`): đẩy một mục "phòng" để Back luôn có mục để
 * về (và chặn được), kể cả khi mở link mời ở tab mới. Đã ở đúng mục phòng đó (tải lại trang, làm
 * lại lượt Kiểm tra não) thì không đẩy thêm.
 */
export function enterRoomEntry(room: string, path: string) {
  if (!canUseHistory()) return;
  const state = readState(history.state);
  const key = keyOf(routeForEntry(path, {}));
  if (state.room === room) commit("replace", path, state, key);
  else commit("push", path, { room }, key);
}

interface GoOptions {
  /** Màn quay về sau khi xong hồ sơ (chỉ khi đi tới `profile`); mặc định menu. */
  profileReturn?: Screen | Route;
  /** Chuyển hướng: thay mục lịch sử hiện tại thay vì đẩy mục mới. */
  replace?: boolean;
}

interface NavStore {
  route: Route;
  /** `route.screen`, tách riêng cho selector gọn. */
  screen: Screen;
  /**
   * Màn một mình đang ở lúc đếm ngược / đang chơi: App ẩn hàng nút nhạc/ngôn ngữ/theme và nhỏ tiếng
   * nhạc như pha `countdown`/`playing` của party.
   */
  soloFocus: boolean;
  /** Màn quay về sau khi sửa hồ sơ (mặc định menu; mở từ Tài khoản thì về Tài khoản). */
  profileReturn: Route;
  /** Hồ sơ mở thay cho màn cần hồ sơ: xong thì thay mục lịch sử bằng `profileReturn`. */
  profileRedirect: boolean;
  /** Chuyển màn (đẩy lịch sử). Màn cần hồ sơ mà chưa có → qua `profile` trước. */
  go(to: Screen | Route, options?: GoOptions): void;
  /**
   * Nút quay lại trong app: mục lịch sử trước đúng là `to` → `history.back()` (không chất thêm lịch
   * sử, Back của trình duyệt sau đó không quay vòng; màn đổi ở `popstate`, có thể chậm một nhịp);
   * không thì đẩy `to` như `go`, hoặc thay mục hiện tại nếu `replace` (rời một màn tạm như hồ sơ
   * mà không để lại hai mục giống nhau liền nhau).
   */
  goBack(to: Screen | Route, options?: { replace?: boolean }): void;
  /**
   * Đổi tab ở trang Hồ sơ: thay mục lịch sử (không chất thêm mục), giữ đích quay về sau khi xong hồ
   * sơ (`next`, `redirect`); `profileReturn` / `profileRedirect` không đổi.
   */
  setProfileTab(tab: ProfileTab): void;
  setSoloFocus(focused: boolean): void;
}

function initialRoute(): Route {
  return canUseHistory() ? routeForEntry(locationPath(), readState(history.state)) : HOME;
}

export const useNav = create<NavStore>((set, get) => ({
  route: initialRoute(),
  screen: initialRoute().screen,
  soloFocus: false,
  profileReturn: { screen: "menu" },
  profileRedirect: false,

  go(to, options = {}) {
    blocked = null;
    let route = toRoute(to);
    let profileReturn = toRoute(options.profileReturn ?? "menu");
    let profileRedirect = false;
    if (needsProfile(route)) {
      profileReturn = route;
      profileRedirect = true;
      route = { screen: "profile" };
    }
    write(
      options.replace ? "replace" : "push",
      route,
      route.screen === "profile" ? profileEntry(profileReturn, profileRedirect) : {},
    );
    set({ route, screen: route.screen, soloFocus: false, profileReturn, profileRedirect });
  },

  goBack(to, options = {}) {
    const route = toRoute(to);
    if (canUseHistory() && index > 0 && keys[index - 1] === keyOf(route) && !needsProfile(route)) {
      history.back();
      return;
    }
    get().go(route, { replace: options.replace });
  },

  setProfileTab(tab) {
    if (get().screen !== "profile") return;
    const route: Route = tab === "accessories" ? { screen: "profile", tab } : { screen: "profile" };
    if (canUseHistory()) {
      const { idx: _idx, menu: _menu, ...extra } = readState(history.state);
      write("replace", route, extra);
    }
    set({ route });
  },

  setSoloFocus: (soloFocus) => set({ soloFocus }),
}));
