import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  WHO_VANISHED_ITEMS,
  WHO_VANISHED_TWINS,
  type WhoVanishedItem,
  type WhoVanishedPuzzle,
  whoVanished,
  whoVanishedRevealMs,
} from "./who-vanished";

const SEEDS_PER_LEVEL = 2_500; // × 4 mức = 10.000 câu
const ITEM_SET: ReadonlySet<string> = new Set(WHO_VANISHED_ITEMS);

function* allPuzzles(d: Difficulty): Generator<WhoVanishedPuzzle> {
  for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
    yield whoVanished.generate(seed * 7919 + 13, seed % 25, d);
  }
}

const EXPECTED: Record<
  Difficulty,
  { cols: number; rows: number; choices: number; shuffled: boolean }
> = {
  0: { cols: 2, rows: 2, choices: 3, shuffled: false },
  1: { cols: 3, rows: 2, choices: 4, shuffled: false },
  2: { cols: 3, rows: 3, choices: 4, shuffled: false },
  3: { cols: 3, rows: 3, choices: 4, shuffled: true },
};

function twinOf(item: WhoVanishedItem): WhoVanishedItem | undefined {
  for (const [a, b] of WHO_VANISHED_TWINS) {
    if (a === item) return b;
    if (b === item) return a;
  }
  return undefined;
}

// Duyệt hàng nghìn câu: nới thời gian chờ để không trượt khi máy bận chạy song song các file test.
describe("who-vanished", { timeout: 60_000 }, () => {
  it("bộ vật có ≥ 16 món khác nhau, cặp cùng loại lấy từ bộ vật và không trùng nhau", () => {
    expect(new Set(WHO_VANISHED_ITEMS).size).toBe(WHO_VANISHED_ITEMS.length);
    expect(WHO_VANISHED_ITEMS.length).toBeGreaterThanOrEqual(16);
    const inPairs = WHO_VANISHED_TWINS.flat();
    expect(new Set(inPairs).size).toBe(inPairs.length);
    for (const item of inPairs) expect(WHO_VANISHED_ITEMS).toContain(item);
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        expect(whoVanished.generate(seed, seed % 9, d)).toEqual(
          whoVanished.generate(seed, seed % 9, d),
        );
      }
    }
  });

  it("câu cố định (seed 777, câu 5) không đổi ngoài ý muốn", () => {
    const fixed = DIFFICULTIES.map((d) => {
      const p = whoVanished.generate(777, 5, d);
      return [p.shown.join(","), p.vanishedCell, p.blankCell, p.choices.join(","), p.answerIndex];
    });
    expect(fixed).toMatchInlineSnapshot(`
      [
        [
          "pineapple,apple-bitten,lemon,banana",
          2,
          2,
          "lemon,mushroom,corn",
          0,
        ],
        [
          "pineapple,apple-bitten,lemon,banana,mushroom,corn",
          3,
          3,
          "banana,pear,cherry,watermelon-whole",
          0,
        ],
        [
          "pineapple,apple-bitten,lemon,banana,mushroom,corn,watermelon-whole,cherry,pear",
          5,
          5,
          "carrot,corn,grapes,strawberry",
          1,
        ],
        [
          "carrot,pear,pumpkin,apple-bitten,pineapple,banana,strawberry,watermelon,corn",
          8,
          7,
          "watermelon-whole,mushroom,corn,lemon",
          2,
        ],
      ]
    `);
  });

  it("mọi câu đố hợp lệ và có đúng MỘT đáp án (10.000 seed × 4 độ khó)", () => {
    // Gom lỗi rồi so một lần: gọi expect hàng chục lần mỗi câu làm test chậm quá 5 giây.
    const errors: string[] = [];
    for (const d of DIFFICULTIES) {
      const want = EXPECTED[d];
      const cells = want.cols * want.rows;
      let n = 0;
      for (const p of allPuzzles(d)) {
        const fail = (msg: string) => errors.push(`mức ${d}, câu ${n}: ${msg}`);
        n++;
        if (p.cols !== want.cols || p.rows !== want.rows) fail("sai cỡ khay");
        if (p.shuffled !== want.shuffled) fail("sai cờ đổi chỗ");
        if (p.viewMs !== 3_000 || p.coverMs !== 400) fail("sai lịch xem/che");

        // Khay lúc xem: đủ ô, món đôi một khác nhau, đều thuộc bộ vật.
        if (p.shown.length !== cells || new Set(p.shown).size !== cells) fail("shown sai");
        if (p.shown.some((x) => !ITEM_SET.has(x))) fail("món lạ trên khay");

        // Khay lúc hỏi: đúng một ô trống, chứa đúng các món của shown trừ món biến mất.
        const vanished = p.shown[p.vanishedCell] as WhoVanishedItem;
        const left = p.remaining.filter((x): x is WhoVanishedItem => x !== null);
        if (p.remaining.length !== cells || left.length !== cells - 1) fail("số ô trống ≠ 1");
        if (p.remaining[p.blankCell] !== null) fail("blankCell không trống");
        const expectLeft = p.shown.filter((x) => x !== vanished);
        if (new Set(left).size !== left.length || expectLeft.some((x) => !left.includes(x))) {
          fail("remaining khác shown trừ món biến mất");
        }

        for (let i = 0; i < cells; i++) {
          if (i === p.vanishedCell) continue;
          // Siêu khó: mọi món còn lại sang ô khác. Mức khác: giữ nguyên chỗ.
          const same = p.remaining[i] === p.shown[i];
          if (p.shuffled === same) fail(`ô ${i} ${p.shuffled ? "không đổi chỗ" : "bị đổi chỗ"}`);
        }
        if (p.shuffled === (p.blankCell === p.vanishedCell)) fail("vị trí ô ? sai luật");

        // Thẻ: đủ số, đôi một khác nhau; thẻ mồi không có trên khay lúc xem.
        if (p.choices.length !== want.choices || new Set(p.choices).size !== want.choices) {
          fail("thẻ sai số lượng hoặc trùng");
        }
        if (p.choices[p.answerIndex] !== vanished) fail("answerIndex không trỏ món biến mất");
        // Đáp án theo luật: món có lúc xem mà không còn lúc hỏi → đúng một thẻ.
        const byRule = p.choices.filter((c) => p.shown.includes(c) && !left.includes(c));
        if (byRule.length !== 1 || byRule[0] !== vanished) fail("không đúng một đáp án theo luật");

        // check(): chỉ thẻ đáp án đúng; isAnswer nhận mọi chỉ số thẻ.
        const correct = p.choices.map((_, i) => i).filter((i) => whoVanished.check(p, i));
        if (correct.length !== 1 || correct[0] !== p.answerIndex) fail("check() sai");
        if (!p.choices.every((_, i) => whoVanished.isAnswer(i)))
          fail("isAnswer từ chối thẻ hợp lệ");
      }
    }
    expect(errors.slice(0, 10)).toEqual([]);
  });

  it("cặp cùng loại: chỉ Siêu khó có, đúng một cặp, và thẻ 'anh em' không thành mẹo đoán", () => {
    for (const d of DIFFICULTIES) {
      let twinCardIsAnswer = 0;
      let total = 0;
      for (const p of allPuzzles(d)) {
        const all = new Set([...p.shown, ...p.choices]);
        const pairsPresent = WHO_VANISHED_TWINS.filter(([a, b]) => all.has(a) && all.has(b));
        if (d < 3) {
          expect(pairsPresent).toHaveLength(0);
          continue;
        }
        expect(pairsPresent).toHaveLength(1);
        const [a, b] = pairsPresent[0] as readonly [WhoVanishedItem, WhoVanishedItem];
        // Một món của cặp còn trên khay lúc hỏi, món kia nằm trên hàng thẻ.
        const left = p.remaining.filter((x) => x !== null);
        const onTray = left.includes(a) ? a : b;
        const onCard = twinOf(onTray) as WhoVanishedItem;
        expect(left).toContain(onTray);
        expect(left).not.toContain(onCard);
        expect(p.choices).toContain(onCard);
        total++;
        if (p.choices[p.answerIndex] === onCard) twinCardIsAnswer++;
      }
      if (d === 3) {
        // Thẻ "anh em" đúng ~1/4 số câu = xác suất của một thẻ bất kỳ.
        expect(twinCardIsAnswer / total).toBeGreaterThan(0.21);
        expect(twinCardIsAnswer / total).toBeLessThan(0.29);
      }
    }
  });

  it("không thiên vị vị trí đáp án và ô biến mất", () => {
    for (const d of DIFFICULTIES) {
      const want = EXPECTED[d];
      const cells = want.cols * want.rows;
      const byCard = new Array(want.choices).fill(0);
      const byCell = new Array(cells).fill(0);
      for (const p of allPuzzles(d)) {
        byCard[p.answerIndex]++;
        byCell[p.vanishedCell]++;
      }
      for (const n of byCard) {
        expect(Math.abs(n / (SEEDS_PER_LEVEL / want.choices) - 1)).toBeLessThan(0.15);
      }
      for (const n of byCell) {
        expect(Math.abs(n / (SEEDS_PER_LEVEL / cells) - 1)).toBeLessThan(0.2);
      }
    }
  });

  it("khó dần theo độ khó (đo được)", () => {
    const stats = DIFFICULTIES.map((d) => {
      const p = whoVanished.generate(1, 0, d);
      return {
        cells: p.shown.length,
        choices: p.choices.length,
        shuffled: p.shuffled ? 1 : 0,
      };
    });
    for (let d = 1; d < stats.length; d++) {
      const prev = stats[d - 1] as (typeof stats)[number];
      const cur = stats[d] as (typeof stats)[number];
      // Không tham số nào giảm, và ít nhất một tham số tăng.
      expect(cur.cells).toBeGreaterThanOrEqual(prev.cells);
      expect(cur.choices).toBeGreaterThanOrEqual(prev.choices);
      expect(cur.shuffled).toBeGreaterThanOrEqual(prev.shuffled);
      expect(cur.cells + cur.choices + cur.shuffled).toBeGreaterThan(
        prev.cells + prev.choices + prev.shuffled,
      );
    }
    // Số món phải nhớ 4 → 6 → 9 → 9; xác suất đoán mò 1/3 → 1/4 → 1/4 → 1/4.
    expect(stats.map((s) => s.cells)).toEqual([4, 6, 9, 9]);
    expect(stats.map((s) => s.choices)).toEqual([3, 4, 4, 4]);
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    expect(whoVanished.isAnswer(0)).toBe(true);
    expect(whoVanished.isAnswer(3)).toBe(true);
    for (const bad of [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      [0],
      {},
    ]) {
      expect(whoVanished.isAnswer(bad)).toBe(false);
    }
  });

  it("speedAllowanceMs = xem + che = 3 400 ms, nhỏ hơn thời lượng vòng", () => {
    for (const d of DIFFICULTIES) {
      const p = whoVanished.generate(42, 3, d);
      const allowance = whoVanished.speedAllowanceMs?.(p, d);
      expect(allowance).toBe(whoVanishedRevealMs(p));
      expect(allowance).toBe(3_400);
      expect(allowance).toBeLessThan(whoVanished.durationMs);
    }
  });

  it("hệ số điểm không giảm khi lên mức", () => {
    const m = whoVanished.difficultyMultiplier;
    expect(m).toBeDefined();
    const values = DIFFICULTIES.map((d) => m?.[d] ?? 0);
    expect(values).toEqual([...values].sort((x, y) => x - y));
    expect(values[1]).toBe(1);
  });
});
