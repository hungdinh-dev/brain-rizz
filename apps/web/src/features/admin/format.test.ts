import { AVATAR_COLORS } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { screenForPath } from "@/stores/nav.store";
import { colorIndexFor, dayDiff, vnDayKey } from "./format";
import { compareToYesterday, niceMax } from "./stats";

describe("ngày theo giờ Việt Nam (CR-019)", () => {
  it("vnDayKey lấy ngày ở Asia/Ho_Chi_Minh, không theo múi giờ máy", () => {
    // 17:30 UTC = 00:30 ngày hôm sau ở Việt Nam (UTC+7).
    expect(vnDayKey(new Date("2026-11-18T17:30:00Z"))).toBe("2026-11-19");
    expect(vnDayKey(new Date("2026-11-18T16:59:00Z"))).toBe("2026-11-18");
  });

  it("dayDiff đếm ngày giữa hai khoá, qua cả tháng", () => {
    expect(dayDiff("2026-11-18", "2026-11-19")).toBe(1);
    expect(dayDiff("2026-10-31", "2026-11-01")).toBe(1);
    expect(dayDiff("2026-11-19", "2026-11-19")).toBe(0);
  });
});

it("màu avatar ổn định theo id và nằm trong bảng màu", () => {
  const a = colorIndexFor("8f0c1d2e-0000-4000-8000-000000000001");
  expect(colorIndexFor("8f0c1d2e-0000-4000-8000-000000000001")).toBe(a);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(a).toBeLessThan(AVATAR_COLORS.length);
});

it("đỉnh trục biểu đồ tròn số", () => {
  expect(niceMax(0)).toBe(4);
  expect(niceMax(3)).toBe(4);
  expect(niceMax(151)).toBe(200);
  expect(niceMax(29)).toBe(40);
  expect(niceMax(1000)).toBe(1000);
});

it("so với hôm qua: theo % khi hôm qua ≥ 10, ít hơn thì theo số", () => {
  expect(compareToYesterday(128, 147)).toEqual({ key: "downPct", n: 13, up: false });
  expect(compareToYesterday(12, 14)).toEqual({ key: "downPct", n: 14, up: false });
  expect(compareToYesterday(12, 9)).toEqual({ key: "upAbs", n: 3, up: true });
  expect(compareToYesterday(5, 5)).toEqual({ key: "same", n: 0, up: null });
  expect(compareToYesterday(5, undefined).key).toBe("same");
});

it("đường dẫn /admin mở trang quản trị, /r/<mã> vào menu", () => {
  expect(screenForPath("/admin").screen).toBe("admin");
  expect(screenForPath("/admin/").screen).toBe("admin");
  expect(screenForPath("/admin/scoring")).toEqual({ screen: "admin", section: "scoring" });
  expect(screenForPath("/r/ABCD").screen).toBe("menu");
  expect(screenForPath("/").screen).toBe("intro");
  expect(screenForPath("/administrator").screen).toBe("intro");
});
