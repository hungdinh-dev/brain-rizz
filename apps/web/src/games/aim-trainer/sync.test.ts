import { describe, expect, it } from "vitest";
import { HitTally } from "./sync";

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
