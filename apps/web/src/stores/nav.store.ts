import { type GameId, isGameId, normalizeRoomCode } from "@brain-rizz/shared";
import { create } from "zustand";

/**
 * Điều hướng ngoài phòng party và đồng bộ thanh địa chỉ bằng History API (CR-022), không dùng thư
 * viện router. Bản đồ URL: docs/01-product/practice-favorites-howto-routes.md mục 3.4.
 *
 * - Người dùng chuyển màn → `pushState`; sửa đường dẫn sai / chuyển hướng → `replaceState`.
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
  | "admin";

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

/** Màn + tham số trên đường dẫn. */
export interface Route {
  screen: Screen;
  /** `/practice/<gameId>` (hướng dẫn game đó), `/leaderboard/<gameId>` (bảng theo game). */
  gameId?: GameId;
  /** `/admin/<mục>`. */
  section?: AdminSection;
  /** Menu mở từ link mời `/r/<mã>` (mã điền sẵn). */
  room?: string;
}

/** Màn cần hồ sơ (tên + bạn đồng hành) trước khi vào, như nút ở menu. */
const PROFILE_SCREENS: readonly Screen[] = ["practice", "brain-test"];

const HOME: Route = { screen: "intro" };

/**
 * Đường dẫn → màn + tham số (hàm thuần, có test). Không phân biệt hoa thường, bỏ qua `/` thừa.
 * `gameId` / mục lạ → màn cha (`/practice`, `/leaderboard`, `/admin`); đường dẫn lạ → `/`.
 */
export function screenForPath(pathname: string): Route {
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
    case "practice":
      return isGameId(arg) ? { screen: "practice", gameId: arg } : { screen: "practice" };
    case "leaderboard":
      return isGameId(arg) ? { screen: "leaderboard", gameId: arg } : { screen: "leaderboard" };
    case "admin":
      return isAdminSection(arg) ? { screen: "admin", section: arg } : { screen: "admin" };
    case "profile":
      return param === undefined ? { screen: "profile" } : HOME;
    case "brain-test":
      return param === undefined ? { screen: "brain-test" } : HOME;
    case "account":
      return param === undefined ? { screen: "account" } : HOME;
    default:
      return HOME;
  }
}

/** Màn + tham số → đường dẫn chuẩn (hàm thuần, có test). Giới thiệu và menu cùng là `/`. */
export function pathForScreen(route: Route): string {
  switch (route.screen) {
    case "intro":
      return "/";
    case "menu":
      return route.room ? `/r/${route.room}` : "/";
    case "practice":
    case "leaderboard":
      return route.gameId ? `/${route.screen}/${route.gameId}` : `/${route.screen}`;
    case "admin":
      return route.section ? `/admin/${route.section}` : "/admin";
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
function routeForEntry(pathname: string, state: EntryState): Route {
  const route = screenForPath(pathname);
  return route.screen === "intro" && state.menu ? { screen: "menu" } : route;
}

/** Màn quay về sau khi xong hồ sơ (đọc từ `next`); mặc định menu. */
function returnRoute(next: string | undefined): Route {
  const route = next ? routeForEntry(next, { menu: true }) : HOME;
  return route.screen === "intro" || route.screen === "profile" ? { screen: "menu" } : route;
}

/** Khoá so sánh hai mục: menu (có hay không có mã mời) coi là một. */
function keyOf(route: Route): string {
  return route.screen === "menu" ? "menu" : `${route.screen}|${pathForScreen(route)}`;
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

/** Ghi một mục lịch sử. Thay mục (`replace`) thì giữ `?query#hash` (quay về từ Google còn `?code=`). */
function commit(mode: "push" | "replace", path: string, extra: EntryState, key: string) {
  const idx = mode === "push" ? index + 1 : index;
  const state: EntryState = { ...extra, idx };
  if (mode === "push") {
    history.pushState(state, "", path);
    keys.length = idx;
  } else if (path !== location.pathname || !sameState(readState(history.state), state)) {
    history.replaceState(state, "", path + location.search + location.hash);
  }
  index = idx;
  keys[idx] = key;
  current = { path, state };
}

/** Ghi mục cho một màn. Đẩy đúng đường dẫn đang ở (vd. giới thiệu → menu, cùng `/`) → thay mục. */
function write(mode: "push" | "replace", route: Route, extra: EntryState = {}) {
  if (!canUseHistory()) return;
  const path = pathForScreen(route);
  const push = mode === "push" && path !== location.pathname;
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
  const target = routeForEntry(location.pathname, state);
  keys[index] = keyOf(target);
  current = { path: location.pathname, state };
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
  current = { path: location.pathname, state };
  apply(routeForEntry(location.pathname, state), state);
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
  setSoloFocus(focused: boolean): void;
}

function initialRoute(): Route {
  return canUseHistory() ? routeForEntry(location.pathname, readState(history.state)) : HOME;
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

  setSoloFocus: (soloFocus) => set({ soloFocus }),
}));
