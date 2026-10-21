import { type RuleGateRule, ruleGate } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  afterAnswer,
  classifyGesture,
  keySide,
  LOG_SIZE,
  type LogEntry,
  logColumns,
  pushLog,
  ruleKey,
  seedLog,
  ticketLayout,
} from "./play-state";

const cat = { species: "cat", hat: false, glasses: false, item: "none" } as const;
const bunny = { species: "bunny", hat: true, glasses: false, item: "book" } as const;

describe("Cổng luật: nhập", () => {
  it("vuốt trái = cho vào, vuốt phải = mời về, chạm ngắn = chạm nút", () => {
    expect(classifyGesture(-80, 10)).toEqual({ kind: "swipe", side: "in" });
    expect(classifyGesture(60, -20)).toEqual({ kind: "swipe", side: "out" });
    expect(classifyGesture(10, 12)).toEqual({ kind: "tap" });
  });

  it("vuốt dọc hoặc chéo không rõ thì bỏ qua", () => {
    expect(classifyGesture(0, -120)).toEqual({ kind: "none" });
    expect(classifyGesture(60, 50)).toEqual({ kind: "none" });
    // Ngang đúng 1,3 lần dọc vẫn nhận.
    expect(classifyGesture(-65, 50)).toEqual({ kind: "swipe", side: "in" });
  });

  it("phím ← / A = vào, → / D = về, phím khác bỏ qua", () => {
    expect(keySide("ArrowLeft", "ArrowLeft")).toBe("in");
    expect(keySide("KeyA", "a")).toBe("in");
    expect(keySide("ArrowRight", "ArrowRight")).toBe("out");
    expect(keySide("KeyD", "d")).toBe("out");
    expect(keySide("", "ArrowLeft")).toBe("in");
    expect(keySide("KeyW", "w")).toBeUndefined();
  });
});

describe("Cổng luật: sổ cổng", () => {
  it("chỉ giữ 4 bạn gần nhất, xếp hai cột theo đáp án đúng, mới nhất trước", () => {
    let log: LogEntry[] = [];
    log = pushLog(log, { buddy: cat, side: "out" });
    log = pushLog(log, { buddy: bunny, side: "in" });
    for (let k = 0; k < 4; k++) log = pushLog(log, { buddy: cat, side: k % 2 ? "in" : "out" });
    expect(log).toHaveLength(LOG_SIZE);
    const columns = logColumns(log);
    expect(columns.in.length + columns.out.length).toBe(LOG_SIZE);
    expect(columns.in.map((s) => s.slot)).toEqual([0, 1]);
    expect(columns.in[0]?.entry).toBe(log[3]);
  });

  it("vào giữa vòng: sổ dựng lại từ đáp án đúng của các câu trước", () => {
    const seed = 0x1234;
    expect(seedLog(seed, 0, 3)).toEqual([]);
    const log = seedLog(seed, 9, 3);
    expect(log).toHaveLength(LOG_SIZE);
    log.forEach((entry, k) => {
      const puzzle = ruleGate.generate(seed, 5 + k, 3);
      expect(entry).toEqual({ buddy: puzzle.buddy, side: puzzle.answer });
    });
    expect(seedLog(seed, 2, 3)).toHaveLength(2);
  });
});

describe("Cổng luật: gợi ý sau 2 câu sai liền", () => {
  it("sai liền 2 câu thì gợi ý rồi đếm lại từ 0; câu đúng xoá chuỗi sai", () => {
    let streak = 0;
    const step = (correct: boolean) => {
      const next = afterAnswer(streak, correct);
      streak = next.streak;
      return next.hint;
    };
    expect(step(false)).toBe(false);
    expect(step(true)).toBe(false);
    expect(step(false)).toBe(false);
    expect(step(false)).toBe(true);
    expect(streak).toBe(0);
    expect(step(false)).toBe(false);
    expect(step(false)).toBe(true);
  });
});

describe("Cổng luật: vé", () => {
  const single: RuleGateRule = { op: "single", terms: [{ feature: "hat", negated: false }] };
  const both: RuleGateRule = {
    op: "and",
    terms: [
      { feature: "cat", negated: false },
      { feature: "book", negated: true },
    ],
  };
  const either: RuleGateRule = { op: "or", terms: both.terms };

  it("một vế: một vé; VÀ: một vé hai biểu tượng nối +; HOẶC: hai vé riêng, giữa có /", () => {
    expect(ticketLayout(single, 420).tickets).toHaveLength(1);
    const and = ticketLayout(both, 420);
    expect(and.tickets).toHaveLength(1);
    expect(and.tickets[0]?.icons.map((i) => i.term)).toEqual([0, 1]);
    expect(and.joiner?.kind).toBe("plus");
    const or = ticketLayout(either, 420);
    expect(or.tickets.map((t) => t.icons.length)).toEqual([1, 1]);
    expect(or.joiner?.kind).toBe("slash");
  });

  it("vé nằm trong bảng (x 60–660) và chừa chỗ mũi tên chỉ cổng bên trái", () => {
    for (const rule of [single, both, either]) {
      for (const t of ticketLayout(rule, 420).tickets) {
        expect(t.cx - t.w / 2).toBeGreaterThanOrEqual(215);
        expect(t.cx + t.w / 2).toBeLessThanOrEqual(640);
      }
    }
  });

  it("khoá luật phân biệt phép nối và phủ định", () => {
    expect(ruleKey(both)).not.toBe(ruleKey(either));
    expect(ruleKey(single)).toBe("single:hat");
    expect(ruleKey(both)).toBe("and:cat,!book");
  });
});
