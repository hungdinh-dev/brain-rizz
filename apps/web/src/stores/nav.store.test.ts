import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Trang quản trị mở bằng đường dẫn `/admin` (CR-019): màn mở đầu theo đường dẫn, và thanh địa chỉ
 * khớp màn khi vào / rời trang quản trị (không đụng tới link mời `/r/<mã>`).
 */

function fakeBrowser(pathname: string) {
  const loc = { pathname };
  const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
    loc.pathname = url;
  });
  vi.stubGlobal("location", loc);
  vi.stubGlobal("history", { state: null, replaceState });
  return { loc, replaceState };
}

async function loadNav(pathname: string) {
  vi.resetModules();
  const browser = fakeBrowser(pathname);
  const { useNav } = await import("./nav.store");
  return { useNav, ...browser };
}

describe("đường dẫn trang quản trị (CR-019)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mở /admin (kể cả quay về từ Google) → màn admin; /r/<mã> → menu; còn lại → giới thiệu", async () => {
    expect((await loadNav("/admin")).useNav.getState().screen).toBe("admin");
    expect((await loadNav("/ADMIN/")).useNav.getState().screen).toBe("admin");
    expect((await loadNav("/r/AB12")).useNav.getState().screen).toBe("menu");
    expect((await loadNav("/")).useNav.getState().screen).toBe("intro");
    expect((await loadNav("/admin/users")).useNav.getState().screen).toBe("intro");
  });

  it("vào trang quản trị từ màn Tài khoản → thanh địa chỉ thành /admin", async () => {
    const { useNav, loc, replaceState } = await loadNav("/");
    useNav.getState().go("account");
    expect(replaceState).not.toHaveBeenCalled();
    useNav.getState().go("admin");
    expect(loc.pathname).toBe("/admin");
    expect(useNav.getState().screen).toBe("admin");
  });

  it("rời trang quản trị → về /; mở lại đúng màn đang ở thì không đổi URL", async () => {
    const { useNav, loc, replaceState } = await loadNav("/admin");
    useNav.getState().go("admin");
    expect(replaceState).not.toHaveBeenCalled();
    useNav.getState().go("menu");
    expect(loc.pathname).toBe("/");
    expect(useNav.getState().screen).toBe("menu");
  });

  it("đổi màn ngoài trang quản trị không đụng tới link mời /r/<mã>", async () => {
    const { useNav, loc, replaceState } = await loadNav("/r/AB12");
    useNav.getState().go("profile");
    useNav.getState().go("menu");
    expect(replaceState).not.toHaveBeenCalled();
    expect(loc.pathname).toBe("/r/AB12");
  });
});
