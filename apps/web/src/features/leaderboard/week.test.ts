import { describe, expect, it } from "vitest";
import { colorIndexOf, vnWeekStart } from "./week";

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("vnWeekStart", () => {
  it("giữa tuần → thứ Hai cùng tuần", () => {
    // Thứ Năm 16/10/2026 10:00 giờ VN.
    expect(day(vnWeekStart(new Date("2026-10-16T03:00:00Z")))).toBe("2026-10-12");
  });

  it("thứ Hai 00:30 giờ VN (vẫn là Chủ nhật theo UTC) → chính thứ Hai đó", () => {
    expect(day(vnWeekStart(new Date("2026-10-11T17:30:00Z")))).toBe("2026-10-12");
  });

  it("Chủ nhật 23:30 giờ VN → thứ Hai tuần trước", () => {
    expect(day(vnWeekStart(new Date("2026-10-18T16:30:00Z")))).toBe("2026-10-12");
  });
});

describe("colorIndexOf", () => {
  it("ổn định và nằm trong bảng màu", () => {
    const a = colorIndexOf("3f2a-uuid", 8);
    expect(a).toBe(colorIndexOf("3f2a-uuid", 8));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(8);
    expect(colorIndexOf("x", 0)).toBe(0);
  });
});
