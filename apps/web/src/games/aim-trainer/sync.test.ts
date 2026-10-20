import { describe, expect, it } from "vitest";
import { HitTally, ignoredByServer, planResync } from "./sync";

describe("HitTally", () => {
  it("chưa có câu đúng: 0 trúng, chưa có ms TB", () => {
    const tally = new HitTally();
    expect(tally.hits).toBe(0);
    expect(tally.avgMs).toBeUndefined();
  });

  it("chỉ đếm câu server chấm đúng, mỗi câu một lần", () => {
    const tally = new HitTally();
    tally.confirm(0, 500);
    tally.confirm(2, 700);
    // Hai lần theo dõi cùng một câu (trước và sau khi đồng bộ lại) cùng nhận kết quả.
    tally.confirm(2, 900);
    expect(tally.hits).toBe(2);
    expect(tally.avgMs).toBe(600);
  });

  it("cú trúng bị chấm muộn và các cú gửi lúc server khoá không được cộng", () => {
    // Câu 3 trúng trên máy nhưng server chấm muộn (sai), câu 4, 5 gửi lúc khoá bị bỏ qua:
    // scene chỉ gọi confirm khi kết quả đúng, nên chip chỉ có câu 0–2.
    const tally = new HitTally();
    for (const [index, ms] of [
      [0, 400],
      [1, 500],
      [2, 600],
    ] as const) {
      tally.confirm(index, ms);
    }
    expect(tally.hits).toBe(3);
    expect(tally.avgMs).toBe(500);
  });

  it("làm tròn ms và không nhận số âm", () => {
    const tally = new HitTally();
    tally.confirm(0, 100.4);
    tally.confirm(1, -20);
    expect(tally.avgMs).toBe(50);
  });
});

describe("planResync", () => {
  it("không khoá: hiện bia câu server đang chờ", () => {
    expect(planResync({ progress: 7, unlockMs: 0 }, { index: 12, lockedIndex: null })).toEqual({
      kind: "show",
      index: 7,
    });
    // Scene đang khoá câu trước mà server đã hết khoá: hiện câu kế ngay.
    expect(planResync({ progress: 7, unlockMs: 0 }, { index: 7, lockedIndex: 6 })).toEqual({
      kind: "show",
      index: 7,
    });
  });

  it("server còn khoá, scene đang khoá đúng câu trước: giữ hình khoá, hẹn lại giờ", () => {
    expect(planResync({ progress: 5, unlockMs: 800 }, { index: 5, lockedIndex: 4 })).toEqual({
      kind: "rearm",
      index: 5,
      unlockMs: 800,
    });
  });

  it("server còn khoá mà scene đang ở câu khác: hiện câu trước như bỏ lỡ", () => {
    expect(planResync({ progress: 5, unlockMs: 800 }, { index: 9, lockedIndex: null })).toEqual({
      kind: "lock",
      index: 5,
      unlockMs: 800,
    });
    expect(planResync({ progress: 5, unlockMs: 800 }, { index: 9, lockedIndex: 8 })).toEqual({
      kind: "lock",
      index: 5,
      unlockMs: 800,
    });
  });

  it("không biết câu server: hiện lại câu đang làm của scene", () => {
    expect(planResync(undefined, { index: 3, lockedIndex: 2 })).toEqual({ kind: "show", index: 3 });
  });

  it("câu 0 không có câu trước để khoá", () => {
    expect(planResync({ progress: 0, unlockMs: 500 }, { index: 2, lockedIndex: null })).toEqual({
      kind: "show",
      index: 0,
    });
  });
});

describe("ignoredByServer", () => {
  it("server chưa qua câu đó: bị bỏ qua", () => {
    expect(ignoredByServer(4, 4)).toBe(true);
    expect(ignoredByServer(4, 3)).toBe(true);
  });

  it("server đã qua câu đó (kết quả mất trên đường): không đồng bộ lại", () => {
    expect(ignoredByServer(4, 5)).toBe(false);
    expect(ignoredByServer(4, 9)).toBe(false);
  });

  it("không biết progress của server: không đồng bộ lại", () => {
    expect(ignoredByServer(4, undefined)).toBe(false);
  });
});
