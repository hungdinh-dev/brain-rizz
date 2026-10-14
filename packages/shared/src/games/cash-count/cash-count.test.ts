import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { CASH_DENOMINATIONS, type CashCountPuzzle, cashCount } from "./cash-count";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả (docs/04-minigames/cash-count.md), theo thứ tự Mầm → Siêu khó. */
const BILL_COUNT: [number, number][] = [
  [3, 3],
  [5, 5],
  [6, 6],
  [2, 3],
];
const MAX_DENOM = [10_000, 100_000, 500_000, 500_000];
/** Thẻ nhiễu ở Siêu khó: tiền thối ± một tờ "thối nhầm". */
const CHANGE_SLIPS = [10_000, 20_000, 50_000, 100_000];

const cache = new Map<Difficulty, CashCountPuzzle[]>();

/** 10.000 câu mỗi mức, sinh một lần rồi dùng chung cho mọi test. */
function puzzlesOf(d: Difficulty): CashCountPuzzle[] {
  let list = cache.get(d);
  if (!list) {
    list = Array.from({ length: SEEDS }, (_, s) => cashCount.generate(s * 7 + 3, s % 41, d));
    cache.set(d, list);
  }
  return list;
}

/** Chạy `fn` cho mọi câu của mọi mức; gom tối đa 5 lỗi đầu tiên để báo. */
function expectEvery(fn: (p: CashCountPuzzle, d: Difficulty) => string | null) {
  const bad: string[] = [];
  let failures = 0;
  for (const d of DIFFICULTIES) {
    puzzlesOf(d).forEach((p, s) => {
      const msg = fn(p, d);
      if (msg === null) return;
      failures++;
      if (bad.length < 5) bad.push(`độ khó ${d}, seed ${s}: ${msg}`);
    });
  }
  expect(bad, `${failures} câu lỗi`).toEqual([]);
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const isDescending = (values: readonly number[]) =>
  values.every((v, i) => i === 0 || values[i - 1]! >= v);

/** Đáp án tính độc lập với bộ sinh: chỉ đọc các tờ và hoá đơn. */
function expected(p: CashCountPuzzle): number {
  return p.mode === "sum" ? sum(p.bills) : sum(p.bills) - p.receipt;
}

/** Số lần nhớ khi cộng `a + b` theo từng chữ số. */
function carries(a: number, b: number): number {
  let count = 0;
  let carry = 0;
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    carry = (x % 10) + (y % 10) + carry >= 10 ? 1 : 0;
    count += carry;
  }
  return count;
}

/** Số lần mượn khi trừ `a − b` (a ≥ b) theo từng chữ số. */
function borrows(a: number, b: number): number {
  let count = 0;
  let borrow = 0;
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    borrow = (x % 10) - (y % 10) - borrow < 0 ? 1 : 0;
    count += borrow;
  }
  return count;
}

/**
 * Mô hình thời gian giải của người lớn (giây), đúng như mục Cân bằng của đặc tả. Số tiền tính theo
 * đơn vị nghìn đồng.
 */
function modelSeconds(p: CashCountPuzzle): number {
  const k = p.bills.map((b) => b / 1_000);
  let t = 0.4;
  for (const b of k) t += b >= 100 ? 0.35 : 0.3;
  let running = k[0]!;
  for (const b of k.slice(1)) {
    t += 0.45 + 0.3 * carries(running, b) + (isDescending(k) ? 0 : 0.15);
    running += b;
  }
  if (p.mode === "change") t += 0.4 + 0.5 + 1.5 + 0.8 * borrows(running, p.receipt / 1_000);
  const correct = p.options[p.answerIndex]!;
  const nearest = Math.min(
    ...p.options.filter((o) => o !== correct).map((o) => Math.abs(o - correct)),
  );
  return t + 0.95 + (nearest / correct <= 0.05 ? 0.3 : 0);
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))]!;
}

// Duyệt hàng nghìn câu: nới thời gian chờ để không trượt khi máy bận chạy song song các file test.
describe("cash-count", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 200; s++) {
        expect(cashCount.generate(s, s % 13, d)).toEqual(cashCount.generate(s, s % 13, d));
      }
    }
  });

  it("câu khác nhau theo index trong cùng vòng", () => {
    for (const d of DIFFICULTIES) {
      const seen = new Set(
        Array.from({ length: 30 }, (_, i) => JSON.stringify(cashCount.generate(42, i, d))),
      );
      expect(seen.size).toBeGreaterThan(20);
    }
  });

  it("mọi câu đố có đúng MỘT đáp án và đáp án khớp phép tính (10.000 seed × 4 độ khó)", () => {
    expectEvery((p) => {
      const correct = [0, 1, 2, 3].filter((i) => cashCount.check(p, i));
      if (correct.length !== 1) return `${correct.length} đáp án đúng`;
      if (p.options[p.answerIndex] !== expected(p)) return "thẻ đúng không khớp phép tính";
      if (p.options.filter((o) => o === expected(p)).length !== 1) return "đáp án xuất hiện 2 lần";
      return null;
    });
  });

  it("4 thẻ tăng dần ngặt, dương, bội của 1 000", () => {
    expectEvery((p) => {
      if (p.options.length !== 4) return `${p.options.length} thẻ`;
      if (!p.options.every((o, i) => i === 0 || p.options[i - 1]! < o)) return "không tăng ngặt";
      if (!p.options.every((o) => Number.isInteger(o) && o > 0 && o % 1_000 === 0)) {
        return `thẻ lạ ${p.options}`;
      }
      return null;
    });
  });

  it("thẻ nhiễu lệch đáp án đúng giá trị một tờ (tờ trên bàn; Siêu khó: tờ thối nhầm)", () => {
    expectEvery((p) => {
      const correct = expected(p);
      const slips = p.mode === "sum" ? p.bills : CHANGE_SLIPS;
      for (const o of p.options) {
        if (o !== correct && !slips.includes(Math.abs(o - correct))) return `thẻ ${o} lệch lạ`;
      }
      return null;
    });
  });

  it("các tờ, độ nghiêng và hoá đơn đúng bảng Độ khó", () => {
    expectEvery((p, d) => {
      const [min, max] = BILL_COUNT[d]!;
      if (p.bills.length < min || p.bills.length > max) return `${p.bills.length} tờ`;
      if (!p.bills.every((b) => (CASH_DENOMINATIONS as readonly number[]).includes(b))) {
        return `mệnh giá lạ ${p.bills}`;
      }
      if (Math.max(...p.bills) > MAX_DENOM[d]!) return `tờ quá lớn ${p.bills}`;
      if (!isDescending(p.bills)) return "các tờ không xếp từ lớn đến nhỏ";
      if (p.tilts.length !== p.bills.length) return "thiếu độ nghiêng";
      if (!p.tilts.every((t) => [-4, -3, -2, 2, 3, 4].includes(t))) return `nghiêng lạ ${p.tilts}`;

      const copies = Math.max(...p.bills.map((b) => p.bills.filter((x) => x === b).length));
      if ((d === 0 || d === 3) && copies !== 1) return "Mầm / Siêu khó có tờ trùng";
      if (copies > 2) return "quá 2 tờ cùng mệnh giá";
      if (d === 2 && copies !== 2) return "Khó không có tờ trùng";
      if (new Set(p.bills).size < Math.min(3, p.bills.length)) return "ít hơn 3 mệnh giá";

      if (d === 0 && sum(p.bills) > 20_000) return `Mầm tổng ${sum(p.bills)}`;
      if (d < 3) return p.mode === "sum" && p.receipt === 0 ? null : "sai chế độ";

      // Siêu khó: tiền thối.
      const paid = sum(p.bills);
      const change = paid - p.receipt;
      if (p.mode !== "change") return "Siêu khó không phải tiền thối";
      if (p.bills.some((b) => b < 10_000)) return "khách đưa tờ nhỏ hơn 10 000";
      if (paid < 200_000) return `tiền đưa ${paid}`;
      if (p.receipt % 10_000 === 0) return `hoá đơn ${p.receipt} không lẻ nghìn`;
      if (change < 11_000 || change > 99_000) return `tiền thối ${change}`;
      if (change > p.receipt) return "tiền thối lớn hơn hoá đơn";
      if (borrows(paid / 1_000, p.receipt / 1_000) < 2) return "phép trừ mượn ít hơn 2 lần";
      return null;
    });
  });

  it("vị trí đáp án đúng chia đều 4 ô (mỗi ô 22–28 %)", () => {
    for (const d of DIFFICULTIES) {
      const counts = [0, 0, 0, 0];
      for (const p of puzzlesOf(d)) counts[p.answerIndex]!++;
      for (const c of counts) {
        expect(c / SEEDS).toBeGreaterThan(0.22);
        expect(c / SEEDS).toBeLessThan(0.28);
      }
    }
  });

  it("Mầm có cả 4 bộ tờ; mức khác đa dạng", () => {
    const sets = DIFFICULTIES.map(
      (d) => new Set(puzzlesOf(d).map((p) => `${p.bills.join(",")}|${p.receipt}`)).size,
    );
    expect(sets[0]).toBe(4);
    expect(sets[1]).toBeGreaterThan(200);
    expect(sets[2]).toBeGreaterThan(1_000);
    expect(sets[3]).toBeGreaterThan(1_000);
  });

  it("khó dần thật: thời gian giải theo mô hình tăng và các mức không chồng nhau", () => {
    const times = DIFFICULTIES.map((d) =>
      puzzlesOf(d)
        .map(modelSeconds)
        .sort((a, b) => a - b),
    );
    const means = times.map((t) => sum(t) / t.length);
    for (let d = 1; d < times.length; d++) {
      expect(means[d]!).toBeGreaterThan(means[d - 1]! + 0.5);
      // 90 % câu mức dưới nhanh hơn 90 % câu mức trên.
      expect(quantile(times[d - 1]!, 0.9)).toBeLessThan(quantile(times[d]!, 0.1));
    }
    // Siêu khó vẫn ≥ 8 câu mỗi vòng 60 s (cộng 0,25 s chuyển câu).
    expect(60 / (means[3]! + 0.25)).toBeGreaterThanOrEqual(8);
  });

  it("khó dần thật: số tờ, độ lớn tổng và số lần nhớ/mượn tăng theo mức", () => {
    const stat = (d: Difficulty, f: (p: CashCountPuzzle) => number) =>
      sum(puzzlesOf(d).map(f)) / SEEDS;
    const bills = DIFFICULTIES.slice(0, 3).map((d) => stat(d, (p) => p.bills.length));
    expect(bills).toEqual([3, 5, 6]);
    const totals = DIFFICULTIES.slice(0, 3).map((d) => stat(d, (p) => sum(p.bills)));
    expect(totals[1]!).toBeGreaterThan(totals[0]! * 3);
    expect(totals[2]!).toBeGreaterThan(totals[1]! * 3);
    // Phần trăm lệch nhỏ nhất giữa thẻ nhiễu và đáp án: thẻ càng sát càng khó loại bằng ước lượng.
    const gap = (p: CashCountPuzzle) => {
      const c = expected(p);
      return Math.min(...p.options.filter((o) => o !== c).map((o) => Math.abs(o - c) / c));
    };
    const gaps = DIFFICULTIES.slice(0, 3).map((d) => stat(d, gap));
    expect(gaps[1]!).toBeLessThan(gaps[0]!);
    expect(gaps[2]!).toBeLessThan(gaps[1]!);
  });

  it("hệ số điểm dương, không giảm theo mức; miễn trừ tất định, hữu hạn, ≥ 0", () => {
    const m = cashCount.difficultyMultiplier!;
    expect(DIFFICULTIES.every((d) => m[d] > 0)).toBe(true);
    for (let d = 1; d < 4; d++) {
      expect(m[d as Difficulty]).toBeGreaterThanOrEqual(m[(d - 1) as Difficulty]);
    }
    const allowance = cashCount.speedAllowanceMs!;
    expectEvery((p, d) => {
      const a = allowance(p, d);
      if (!Number.isFinite(a) || a < 0) return `miễn trừ ${a}`;
      if (a !== allowance(cashCount.generate(1, 0, d), d) && d !== 3) return "miễn trừ lệch mức";
      return null;
    });
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    for (const ok of [0, 1, 2, 3]) expect(cashCount.isAnswer(ok)).toBe(true);
    for (const bad of [-1, 4, 1.5, "0", null, undefined, [0], Number.NaN]) {
      expect(cashCount.isAnswer(bad)).toBe(false);
    }
  });
});
