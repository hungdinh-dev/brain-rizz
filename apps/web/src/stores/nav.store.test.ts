import { CATEGORIES, GAME_IDS } from "@brain-rizz/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECTIONS, pathForScreen, type Route, screenForPath } from "./nav.store";

const LEVELS = [0, 1, 2, 3] as const;

/**
 * Tách URL (CR-022, kế hoạch practice-favorites-howto-routes.md mục 3.4): bản đồ đường dẫn ↔ màn
 * (hàm thuần) và đồng bộ History API: chuyển màn → push, sửa đường dẫn / chuyển hướng → replace,
 * Back/Forward → đổi màn không đẩy thêm, Back trong phòng / lúc đang chơi bị chặn để hỏi trước.
 */

describe("bản đồ URL (hàm thuần)", () => {
  it("khứ hồi pathForScreen → screenForPath cho mọi màn, mọi game, mọi mục quản trị", () => {
    const routes: Route[] = [
      { screen: "intro" },
      { screen: "profile" },
      { screen: "practice" },
      { screen: "brain-test" },
      { screen: "leaderboard" },
      { screen: "account" },
      { screen: "admin" },
      { screen: "gacha" },
      { screen: "wardrobe" },
      { screen: "wardrobe", tab: "pets" },
      { screen: "menu", room: "AB12" },
      ...GAME_IDS.map((gameId): Route => ({ screen: "practice", gameId })),
      ...GAME_IDS.map((gameId): Route => ({ screen: "leaderboard", gameId })),
      ...ADMIN_SECTIONS.map((section): Route => ({ screen: "admin", section })),
      // Luyện tập: lọc nhóm / Yêu thích (`?cat=`), mức tối thiểu (`?d=`).
      ...[...CATEGORIES, "fav" as const].map((filter): Route => ({ screen: "practice", filter })),
      ...GAME_IDS.flatMap((gameId) =>
        LEVELS.map((level): Route => ({ screen: "practice", gameId, level })),
      ),
    ];
    for (const route of routes) expect(screenForPath(pathForScreen(route))).toEqual(route);
  });

  it("Luyện tập: ?cat= chỉ ở /practice, ?d= chỉ ở /practice/<game>; giá trị lạ bị bỏ", () => {
    expect(pathForScreen({ screen: "practice", filter: "analyze" })).toBe("/practice?cat=analyze");
    expect(pathForScreen({ screen: "practice", filter: "fav" })).toBe("/practice?cat=fav");
    expect(pathForScreen({ screen: "practice", gameId: "balance", level: 1 })).toBe(
      "/practice/balance?d=1",
    );
    // `filter` đi với game thì thôi (màn hướng dẫn không có lọc).
    expect(pathForScreen({ screen: "practice", gameId: "balance", filter: "analyze" })).toBe(
      "/practice/balance",
    );

    expect(screenForPath("/Practice/?CAT=x&cat=Analyze#top")).toEqual({
      screen: "practice",
      filter: "analyze",
    });
    expect(screenForPath("/practice/balance?d=2&code=abc")).toEqual({
      screen: "practice",
      gameId: "balance",
      level: 2,
    });
    for (const path of [
      "/practice?cat=xyz",
      "/practice?cat=",
      "/practice?d=1",
      "/practice?cat=all",
    ]) {
      expect(screenForPath(path)).toEqual({ screen: "practice" });
    }
    for (const path of [
      "/practice/balance?d=4",
      "/practice/balance?d=",
      "/practice/balance?d=1.0",
      "/practice/balance?d=-1",
      "/practice/balance?cat=analyze",
    ]) {
      expect(screenForPath(path)).toEqual({ screen: "practice", gameId: "balance" });
    }
    expect(screenForPath("/practice/khong-co-game?cat=analyze")).toEqual({ screen: "practice" });
    expect(screenForPath("/leaderboard?cat=analyze")).toEqual({ screen: "leaderboard" });
  });

  it("đường dẫn chuẩn theo bảng 3.4; giới thiệu và menu cùng là /", () => {
    expect(pathForScreen({ screen: "intro" })).toBe("/");
    expect(pathForScreen({ screen: "menu" })).toBe("/");
    expect(pathForScreen({ screen: "menu", room: "AB12" })).toBe("/r/AB12");
    expect(pathForScreen({ screen: "practice", gameId: "balance" })).toBe("/practice/balance");
    expect(pathForScreen({ screen: "leaderboard", gameId: "balance" })).toBe(
      "/leaderboard/balance",
    );
    expect(pathForScreen({ screen: "admin", section: "scoring" })).toBe("/admin/scoring");
    expect(pathForScreen({ screen: "brain-test" })).toBe("/brain-test");
    // Máy quay phụ kiện, Tủ đồ (CR-023, CR-024); món "Mặc thử" chỉ trong bộ nhớ, không lên URL.
    expect(pathForScreen({ screen: "gacha" })).toBe("/gacha");
    expect(pathForScreen({ screen: "wardrobe" })).toBe("/wardrobe");
    expect(pathForScreen({ screen: "wardrobe", tab: "accessories" })).toBe("/wardrobe");
    expect(pathForScreen({ screen: "wardrobe", tab: "pets" })).toBe("/wardrobe/pets");
    expect(pathForScreen({ screen: "wardrobe", tryOn: "crown" })).toBe("/wardrobe");
  });

  it("Máy quay, Tủ đồ: tab lạ → tab Phụ kiện; tham số thừa → giới thiệu", () => {
    expect(screenForPath("/Wardrobe/Pets/")).toEqual({ screen: "wardrobe", tab: "pets" });
    expect(screenForPath("/wardrobe/accessories")).toEqual({ screen: "wardrobe" });
    expect(screenForPath("/wardrobe/crown")).toEqual({ screen: "wardrobe" });
    expect(screenForPath("/GACHA")).toEqual({ screen: "gacha" });
    for (const path of ["/gacha/10", "/wardrobe/pets/x"]) {
      expect(screenForPath(path)).toEqual({ screen: "intro" });
    }
  });

  it("gameId / mục lạ → màn cha; đường dẫn lạ → giới thiệu; không phân biệt hoa thường", () => {
    expect(screenForPath("/practice/khong-co-game")).toEqual({ screen: "practice" });
    expect(screenForPath("/practice/constructor")).toEqual({ screen: "practice" });
    expect(screenForPath("/leaderboard/xyz")).toEqual({ screen: "leaderboard" });
    expect(screenForPath("/admin/users")).toEqual({ screen: "admin" });
    expect(screenForPath("/Practice/Balance/")).toEqual({ screen: "practice", gameId: "balance" });
    expect(screenForPath("/ADMIN/")).toEqual({ screen: "admin" });
    expect(screenForPath("/r/ab12")).toEqual({ screen: "menu", room: "AB12" });
    for (const path of ["/r/AB1", "/r/AB12/x", "/khong-co", "/practice/balance/x", "/account/x"]) {
      expect(screenForPath(path)).toEqual({ screen: "intro" });
    }
  });
});

interface Entry {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
}

function parse(url: string, state: unknown): Entry {
  const u = new URL(url, "https://brain-rizz.test");
  return { pathname: u.pathname, search: u.search, hash: u.hash, state };
}

/** Trình duyệt giả: ngăn lịch sử thật (push cắt nhánh phía trước), Back/Forward bắn `popstate`. */
function fakeBrowser(url: string, state: unknown) {
  const entries: Entry[] = [parse(url, state)];
  let at = 0;
  const cur = () => entries[at] as Entry;
  const win = new EventTarget();
  const move = (delta: number) => {
    if (at + delta < 0 || at + delta >= entries.length) return;
    at += delta;
    win.dispatchEvent(new Event("popstate"));
  };
  const hist = {
    get state() {
      return cur().state;
    },
    get length() {
      return entries.length;
    },
    pushState: vi.fn((s: unknown, _title: string, u: string) => {
      entries.splice(at + 1);
      entries.push(parse(u, s));
      at += 1;
    }),
    replaceState: vi.fn((s: unknown, _title: string, u: string) => {
      entries[at] = parse(u, s);
    }),
    back: vi.fn(() => move(-1)),
    forward: vi.fn(() => move(1)),
  };
  vi.stubGlobal("location", {
    get pathname() {
      return cur().pathname;
    },
    get search() {
      return cur().search;
    },
    get hash() {
      return cur().hash;
    },
  });
  vi.stubGlobal("history", hist);
  vi.stubGlobal("window", win);
  return { hist, url: () => cur().pathname + cur().search, entryState: () => cur().state };
}

const stops: (() => void)[] = [];

/** Mở app ở `url` (F5 = mở lại với `state` của mục đó). */
async function open(url: string, options: { state?: unknown; hasProfile?(): boolean } = {}) {
  vi.resetModules();
  const browser = fakeBrowser(url, options.state ?? null);
  const nav = await import("./nav.store");
  stops.push(nav.initNav({ hasProfile: options.hasProfile ?? (() => true) }));
  return { ...browser, ...nav, nav: () => nav.useNav.getState() };
}

describe("đồng bộ History API (CR-022)", () => {
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    vi.unstubAllGlobals();
  });

  it("mở link sâu: đúng màn; đường dẫn lạ / id lạ sửa bằng replace, không đẩy lịch sử", async () => {
    const practice = await open("/practice/khong-co-game");
    expect(practice.nav().route).toEqual({ screen: "practice" });
    expect(practice.url()).toBe("/practice");
    expect(practice.hist.length).toBe(1);
    expect(practice.hist.pushState).not.toHaveBeenCalled();

    const board = await open("/leaderboard/xyz");
    expect(board.nav().route).toEqual({ screen: "leaderboard" });
    expect(board.url()).toBe("/leaderboard");

    const unknown = await open("/khong-co");
    expect(unknown.nav().screen).toBe("intro");
    expect(unknown.url()).toBe("/");

    const admin = await open("/admin/scoring");
    expect(admin.nav().route).toEqual({ screen: "admin", section: "scoring" });
    expect(admin.url()).toBe("/admin/scoring");
  });

  it("quay về từ Google: sửa / chuyển hướng đường dẫn vẫn giữ ?code= cho supabase-js", async () => {
    const admin = await open("/admin/?code=abc");
    expect(admin.nav().screen).toBe("admin");
    expect(admin.url()).toBe("/admin?code=abc");

    const account = await open("/?code=abc");
    account.nav().go("account", { replace: true });
    expect(account.url()).toBe("/account?code=abc");
    expect(account.hist.length).toBe(1);
  });

  it("Luyện tập ?cat= / ?d=: mở đúng lọc / mức; giá trị lạ bỏ bằng replace, giữ ?code=", async () => {
    const cat = await open("/practice?cat=analyze");
    expect(cat.nav().route).toEqual({ screen: "practice", filter: "analyze" });
    expect(cat.url()).toBe("/practice?cat=analyze");

    const level = await open("/practice/balance?d=1");
    expect(level.nav().route).toEqual({ screen: "practice", gameId: "balance", level: 1 });
    expect(level.url()).toBe("/practice/balance?d=1");

    const bad = await open("/practice?cat=xyz&code=abc");
    expect(bad.nav().route).toEqual({ screen: "practice" });
    expect(bad.url()).toBe("/practice?code=abc");
    expect(bad.hist.length).toBe(1);
    expect(bad.hist.pushState).not.toHaveBeenCalled();

    const badLevel = await open("/practice/balance?d=9");
    expect(badLevel.nav().route).toEqual({ screen: "practice", gameId: "balance" });
    expect(badLevel.url()).toBe("/practice/balance");

    // Tham số sai màn bị bỏ; tham số không phải của nav giữ nguyên.
    const mixed = await open("/practice/balance?code=abc&cat=analyze&d=2");
    expect(mixed.nav().route).toEqual({ screen: "practice", gameId: "balance", level: 2 });
    expect(mixed.url()).toBe("/practice/balance?d=2&code=abc");
  });

  it("đổi chip lọc → replace; 'Chọn game khác' quay lại đúng mục lưới, giữ lọc", async () => {
    const b = await open("/");
    b.nav().go("menu");
    b.nav().go({ screen: "practice", filter: "analyze" });
    expect(b.url()).toBe("/practice?cat=analyze");
    expect(b.hist.length).toBe(2);

    // Chip: thay mục, không chất lịch sử.
    b.nav().go({ screen: "practice", filter: "memorize" }, { replace: true });
    expect(b.url()).toBe("/practice?cat=memorize");
    b.nav().go({ screen: "practice" }, { replace: true });
    expect(b.url()).toBe("/practice");
    b.nav().go({ screen: "practice", filter: "fav" }, { replace: true });
    expect(b.hist.length).toBe(2);

    b.nav().go({ screen: "practice", gameId: "balance" });
    b.nav().goBack({ screen: "practice" });
    expect(b.hist.back).toHaveBeenCalledTimes(1);
    expect(b.nav().route).toEqual({ screen: "practice", filter: "fav" });
    expect(b.url()).toBe("/practice?cat=fav");

    // Back về menu, Forward lại đúng lọc.
    b.hist.back();
    expect(b.nav().screen).toBe("menu");
    b.hist.forward();
    expect(b.nav().route).toEqual({ screen: "practice", filter: "fav" });
  });

  it("link sâu có ?cat= khi chưa có hồ sơ → chọn bạn đồng hành, xong về đúng lọc", async () => {
    let hasProfile = false;
    const b = await open("/practice?cat=analyze", { hasProfile: () => hasProfile });
    expect(b.url()).toBe("/profile");
    expect(b.nav().profileReturn).toEqual({ screen: "practice", filter: "analyze" });
    hasProfile = true;
    b.nav().go(b.nav().profileReturn, { replace: true });
    expect(b.url()).toBe("/practice?cat=analyze");
    expect(b.hist.length).toBe(1);
  });

  it("chuyển màn → push; cùng đường dẫn (giới thiệu → menu) → replace; Back/Forward không đẩy thêm", async () => {
    const b = await open("/");
    expect(b.nav().screen).toBe("intro");
    b.nav().go("menu");
    expect(b.hist.length).toBe(1);
    b.nav().go("practice");
    b.nav().go({ screen: "practice", gameId: "balance" });
    expect(b.url()).toBe("/practice/balance");
    expect(b.hist.length).toBe(3);

    const pushes = b.hist.pushState.mock.calls.length;
    b.hist.back();
    expect(b.nav().route).toEqual({ screen: "practice" });
    b.hist.back();
    // `/` có dấu menu → về menu, không về màn giới thiệu.
    expect(b.nav().screen).toBe("menu");
    b.hist.forward();
    b.hist.forward();
    expect(b.nav().route).toEqual({ screen: "practice", gameId: "balance" });
    expect(b.hist.pushState.mock.calls.length).toBe(pushes);
    expect(b.hist.length).toBe(3);
  });

  it("F5 giữ đúng màn (kể cả menu ở /)", async () => {
    const b = await open("/");
    b.nav().go("menu");
    const reloaded = await open("/", { state: b.entryState() });
    expect(reloaded.nav().screen).toBe("menu");

    const deep = await open("/leaderboard/balance");
    expect(deep.nav().route).toEqual({ screen: "leaderboard", gameId: "balance" });
  });

  it("nút quay lại trong app: mục trước đúng là màn đích → history.back(), không thì push", async () => {
    const b = await open("/");
    b.nav().go("menu");
    b.nav().go("leaderboard");
    b.nav().goBack("menu");
    expect(b.hist.back).toHaveBeenCalledTimes(1);
    expect(b.nav().screen).toBe("menu");
    expect(b.url()).toBe("/");

    const deep = await open("/leaderboard");
    deep.nav().goBack("menu");
    expect(deep.hist.back).not.toHaveBeenCalled();
    expect(deep.nav().screen).toBe("menu");
    expect(deep.hist.length).toBe(2);
  });

  it("xong hồ sơ sau khi bấm Tạo/Vào phòng: quay lại mục menu, không để hai mục / liền nhau", async () => {
    const b = await open("/");
    b.nav().go("menu");
    b.nav().go("profile");
    expect(b.url()).toBe("/profile");
    expect(b.hist.length).toBe(2);

    // HomeScreen.confirmProfile: mục trước là menu → history.back(), không replace thành `/` thứ hai.
    b.nav().goBack("menu", { replace: true });
    expect(b.hist.back).toHaveBeenCalledTimes(1);
    expect(b.nav().screen).toBe("menu");
    expect(b.url()).toBe("/");

    // Việc dở (Luyện tập) đẩy mục mới thay cho /profile phía trước: lịch sử [/, /practice].
    b.nav().go("practice");
    expect(b.hist.length).toBe(2);
    // Back đầu tiên về đúng menu (không phải một mục `/` trùng rồi mới về).
    b.hist.back();
    expect(b.nav().screen).toBe("menu");
    expect(b.url()).toBe("/");
  });

  it("xong hồ sơ từ link mời /r/<mã>: quay lại đúng /r/<mã>, vào phòng đẩy một mục phòng", async () => {
    const b = await open("/r/ab12");
    b.nav().go("profile");
    b.nav().goBack("menu", { replace: true });
    expect(b.url()).toBe("/r/AB12");
    expect(b.nav().route).toEqual({ screen: "menu", room: "AB12" });
    b.enterRoomEntry("AB12", "/r/AB12");
    expect(b.hist.length).toBe(2);
    expect(b.entryState()).toMatchObject({ room: "AB12" });
  });

  it("goBack có replace: mục trước không phải màn đích → thay mục hiện tại, không đẩy thêm", async () => {
    const b = await open("/profile");
    b.nav().goBack("menu", { replace: true });
    expect(b.hist.back).not.toHaveBeenCalled();
    expect(b.hist.pushState).not.toHaveBeenCalled();
    expect(b.nav().screen).toBe("menu");
    expect(b.url()).toBe("/");
    expect(b.hist.length).toBe(1);

    // Không có replace thì như cũ: đẩy màn đích.
    const pushed = await open("/profile");
    pushed.nav().goBack("menu");
    expect(pushed.hist.length).toBe(2);
  });

  it("đã rời phòng, Forward về /r/<mã> khi menu vẫn mở → route.room đổi (ô mã điền lại)", async () => {
    const b = await open("/");
    b.nav().go("menu");
    b.enterRoomEntry("AB12", "/r/AB12");
    // Back trong phòng → hỏi; đồng ý rời: gỡ guard, leaveParty thay mục bằng menu `/`.
    const remove = b.setBackGuard(() => true);
    b.hist.back();
    remove();
    b.nav().go("menu", { replace: true });
    expect(b.nav().route).toEqual({ screen: "menu" });

    // HomeScreen không đổi màn (menu → menu) nên phải theo dõi `route.room`, không đọc một lần.
    const seen: { screen: string; room?: string }[] = [];
    const stop = b.useNav.subscribe((s) => seen.push({ screen: s.screen, room: s.route.room }));
    b.hist.forward();
    stop();
    expect(b.url()).toBe("/r/AB12");
    expect(seen).toEqual([{ screen: "menu", room: "AB12" }]);

    // Back về `/`: không còn mã trên đường dẫn (menu giữ nguyên chữ đang gõ).
    b.hist.back();
    expect(b.nav().route).toEqual({ screen: "menu" });
  });

  it("/admin/<mục>: bấm mục đẩy lịch sử, Back về mục trước", async () => {
    const b = await open("/admin/overview");
    b.nav().go({ screen: "admin", section: "scoring" });
    expect(b.url()).toBe("/admin/scoring");
    b.hist.back();
    expect(b.nav().route).toEqual({ screen: "admin", section: "overview" });
  });

  it("link sâu khi chưa có hồ sơ → chọn bạn đồng hành (replace), xong thì về đúng màn đó", async () => {
    let hasProfile = false;
    const b = await open("/practice/balance", { hasProfile: () => hasProfile });
    expect(b.nav().screen).toBe("profile");
    expect(b.url()).toBe("/profile");
    expect(b.nav().profileReturn).toEqual({ screen: "practice", gameId: "balance" });
    expect(b.nav().profileRedirect).toBe(true);
    const profileState = b.entryState();

    hasProfile = true;
    b.nav().go(b.nav().profileReturn, { replace: true });
    expect(b.url()).toBe("/practice/balance");
    expect(b.hist.length).toBe(1);

    // F5 ở màn hồ sơ vẫn nhớ đích.
    const reloaded = await open("/profile", { state: profileState, hasProfile: () => false });
    expect(reloaded.nav().profileReturn).toEqual({ screen: "practice", gameId: "balance" });
    expect(reloaded.nav().profileRedirect).toBe(true);

    // Màn không cần hồ sơ thì mở thẳng.
    expect((await open("/leaderboard", { hasProfile: () => false })).nav().screen).toBe(
      "leaderboard",
    );
    expect((await open("/gacha", { hasProfile: () => false })).nav().screen).toBe("gacha");
    // Tủ đồ sửa hồ sơ (phụ kiện, bạn đồng hành) → chọn hồ sơ trước, xong về đúng tab.
    const wardrobe = await open("/wardrobe/pets", { hasProfile: () => false });
    expect(wardrobe.url()).toBe("/profile");
    expect(wardrobe.nav().profileReturn).toEqual({ screen: "wardrobe", tab: "pets" });
  });

  it("sửa hồ sơ từ Tài khoản: Back rồi Forward vẫn nhớ quay về Tài khoản", async () => {
    const b = await open("/account");
    b.nav().go("profile", { profileReturn: "account" });
    expect(b.url()).toBe("/profile");
    b.hist.back();
    b.hist.forward();
    expect(b.nav().profileReturn).toEqual({ screen: "account" });
  });

  it("link mời /r/<mã>: menu có mã; vào phòng đẩy đúng một mục phòng (tải lại không đẩy thêm)", async () => {
    const b = await open("/r/ab12");
    expect(b.nav().route).toEqual({ screen: "menu", room: "AB12" });
    expect(b.url()).toBe("/r/AB12");

    b.enterRoomEntry("AB12", "/r/AB12");
    expect(b.hist.length).toBe(2);
    expect(b.entryState()).toMatchObject({ room: "AB12" });
    b.enterRoomEntry("AB12", "/r/AB12");
    expect(b.hist.length).toBe(2);

    const reloaded = await open("/r/AB12", { state: b.entryState() });
    reloaded.enterRoomEntry("AB12", "/r/AB12");
    expect(reloaded.hist.pushState).not.toHaveBeenCalled();
  });

  it("Back trong phòng → hỏi trước: không đổi màn, không đẩy lịch sử; Ở lại → đẩy lại mục phòng", async () => {
    const b = await open("/");
    b.nav().go("menu");
    b.enterRoomEntry("AB12", "/r/AB12");
    const asked: Route[] = [];
    const remove = b.setBackGuard((target) => {
      asked.push(target);
      return true;
    });
    const pushes = b.hist.pushState.mock.calls.length;

    b.hist.back();
    expect(asked).toEqual([{ screen: "menu" }]);
    expect(b.url()).toBe("/");
    expect(b.hist.pushState.mock.calls.length).toBe(pushes);

    b.restoreEntry();
    expect(b.url()).toBe("/r/AB12");
    expect(b.entryState()).toMatchObject({ room: "AB12" });
    expect(b.hist.length).toBe(2);

    // Đồng ý rời: về màn trước bằng replace, mục bị chặn bỏ đi (Ở lại sau đó không đẩy gì).
    b.hist.back();
    b.nav().go(asked[1] as Route, { replace: true });
    b.restoreEntry();
    expect(b.url()).toBe("/");
    expect(b.nav().screen).toBe("menu");

    // Gỡ guard (đã ra khỏi phòng) → Back/Forward đổi màn bình thường.
    remove();
    b.hist.forward();
    expect(asked).toHaveLength(2);
    expect(b.nav().route).toEqual({ screen: "menu", room: "AB12" });
  });

  it("bấm Back nhiều lần khi hộp Rời phòng đang mở: Ở lại vẫn đẩy lại đúng mục phòng", async () => {
    const b = await open("/");
    b.nav().go("leaderboard");
    b.nav().go("menu");
    b.enterRoomEntry("AB12", "/r/AB12");
    const asked: Route[] = [];
    b.setBackGuard((target) => {
      asked.push(target);
      return true;
    });

    b.hist.back();
    b.hist.back();
    expect(asked).toEqual([{ screen: "menu" }, { screen: "leaderboard" }]);
    expect(b.url()).toBe("/leaderboard");
    // Màn không đổi theo các lần Back bị chặn.
    expect(b.nav().screen).toBe("menu");

    b.restoreEntry();
    expect(b.url()).toBe("/r/AB12");
    expect(b.entryState()).toMatchObject({ room: "AB12" });
    // Đẩy lại một lần duy nhất; lần gọi thừa không đẩy thêm.
    b.restoreEntry();
    expect(b.url()).toBe("/r/AB12");
    expect(b.hist.length).toBe(3);
  });

  it("Back lúc đang chơi Luyện tập: guard giữ màn, đẩy lại đúng /practice/<gameId>", async () => {
    const b = await open("/practice");
    b.nav().go({ screen: "practice", gameId: "balance" });
    b.setBackGuard(() => {
      b.restoreEntry();
      return true;
    });
    b.hist.back();
    expect(b.nav().route).toEqual({ screen: "practice", gameId: "balance" });
    expect(b.url()).toBe("/practice/balance");
    expect(b.hist.length).toBe(2);
  });
});
