import { describe, expect, it } from "vitest";
import { PODIUM_TIMING, podiumTimeline } from "./podium-timeline";

describe("lịch hiện vinh danh", () => {
  it("6 người (3 hàng hạng 4+): khớp bảng ví dụ ui-ux 6.2", () => {
    const t = podiumTimeline({ podiumSizes: [1, 1, 1], restCount: 3, bestRows: 5 });
    // Hàng hiển thị trên cùng (hạng 4) lật sau cùng: từ dưới lên 600 · 1.050 · 1.500.
    expect(t.rest).toEqual([1500, 1050, 600]);
    expect(t.podium).toEqual([6700, 3800, 2400]);
    expect(t.drum).toEqual({ start: 4700, end: 6700 });
    expect(t.best).toEqual({ start: 8300, rows: [8300, 8420, 8540, 8660, 8780] });
    expect(t.end).toBe(8780);
  });

  it("4 người → hạng 1 lúc 5,8 s; 8 người → 7,6 s", () => {
    expect(podiumTimeline({ podiumSizes: [1, 1, 1], restCount: 1, bestRows: 0 }).podium[0]).toBe(
      5800,
    );
    expect(podiumTimeline({ podiumSizes: [1, 1, 1], restCount: 5, bestRows: 0 }).podium[0]).toBe(
      7600,
    );
  });

  it("không có hạng 4+: hạng 3 lật lúc 600", () => {
    const t = podiumTimeline({ podiumSizes: [1, 1, 1], restCount: 0, bestRows: 0 });
    expect(t.rest).toEqual([]);
    expect(t.podium[2]).toBe(PODIUM_TIMING.first);
    expect(t.best).toBeNull();
  });

  it("2 người (bậc 3 trống): hạng 2 dời lên chỗ hạng 3, không chờ", () => {
    const t = podiumTimeline({ podiumSizes: [1, 1, 0], restCount: 0, bestRows: 1 });
    expect(t.podium).toEqual([3500, 600, null]);
    expect(t.drum).toEqual({ start: 1500, end: 3500 });
    expect(t.best?.start).toBe(5100);
  });

  it("đồng hạng nhất (bậc 2 trống): trống dồn dời lên chỗ hạng 2", () => {
    const t = podiumTimeline({ podiumSizes: [2, 0, 1], restCount: 1, bestRows: 0 });
    expect(t.podium[1]).toBeNull();
    expect(t.podium[2]).toBe(1500);
    expect(t.drum?.start).toBe(2900);
    expect(t.podium[0]).toBe(4900);
  });

  it("mỗi nhịp đến sau nhịp trước; thẻ thể loại sau hạng 1", () => {
    for (let restCount = 0; restCount <= 5; restCount++) {
      const t = podiumTimeline({ podiumSizes: [1, 1, 1], restCount, bestRows: 3 });
      const order = [
        ...[...t.rest].reverse(),
        t.podium[2],
        t.podium[1],
        t.drum?.start,
        t.podium[0],
      ];
      for (let i = 1; i < order.length; i++) {
        expect(order[i] ?? 0).toBeGreaterThan(order[i - 1] ?? 0);
      }
      expect(t.best?.start ?? 0).toBeGreaterThan(t.podium[0] ?? 0);
      expect(t.end).toBe(t.best?.rows.at(-1));
    }
  });
});
