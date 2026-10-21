import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { deriveSeed } from "../../rng";
import {
  STACK_RECALL_KINDS,
  type StackRecallPuzzle,
  stackRecall,
  stackRecallOnTrack,
  stackRecallRevealMs,
} from "./stack-recall";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả, chép lại độc lập với code để test bắt được chỗ lệch. */
const SPEC: Record<
  Difficulty,
  {
    N: number;
    K: number;
    ordered: boolean;
    repeats: boolean;
    shuffled: boolean;
    showMs: number;
    revealMs: number;
    allowanceMs: number;
  }
> = {
  0: {
    N: 2,
    K: 4,
    ordered: false,
    repeats: false,
    shuffled: false,
    showMs: 2_500,
    revealMs: 2_900,
    allowanceMs: 3_200,
  },
  1: {
    N: 3,
    K: 5,
    ordered: true,
    repeats: false,
    shuffled: false,
    showMs: 2_500,
    revealMs: 2_900,
    allowanceMs: 3_500,
  },
  2: {
    N: 4,
    K: 6,
    ordered: true,
    repeats: true,
    shuffled: false,
    showMs: 2_000,
    revealMs: 2_400,
    allowanceMs: 3_300,
  },
  3: {
    N: 5,
    K: 8,
    ordered: true,
    repeats: true,
    shuffled: true,
    showMs: 2_000,
    revealMs: 2_400,
    allowanceMs: 3_600,
  },
};

/**
 * Số đáp án khác nhau theo luật (tính tay ở đặc tả): Mầm C(4,2) = 6 tập hợp; Thường 5·4·3 = 60;
 * Khó 6·5·4·3 + 3 cặp · 6·5·4 = 720; Siêu khó 8·7·6·5·4 + 6 cặp · 8·7·6·5 = 16 800.
 */
const ANSWER_SPACE = [6, 60, 720, 16_800];

/**
 * Xác suất lớn nhất của một đáp án cụ thể (mức may rủi khi đoán một đáp án cố định): Mầm 1/6,
 * Thường 1/60, Khó 1/720 (hai nhánh đều 360 tháp), Siêu khó ½ · 1/6 720 (nhánh không lặp).
 */
const MAX_TOWER_P = [1 / 6, 1 / 60, 1 / 720, 1 / 13_440];

/** Seed vòng thứ i, trộn đều 32 bit (không lệ thuộc cách `deriveSeed` trộn chỉ số câu). */
const roundSeedOf = (i: number) => deriveSeed(0x5eed5eed, i, 3);

/** Duyệt `count` câu của một mức: mỗi câu một seed vòng, index xoay vòng 0–19. */
function forEachPuzzle(
  d: Difficulty,
  fn: (p: StackRecallPuzzle, roundSeed: number, index: number) => void,
  count = SEEDS,
) {
  for (let i = 0; i < count; i++) {
    const roundSeed = roundSeedOf(i);
    const index = i % 20;
    fn(stackRecall.generate(roundSeed, index, d), roundSeed, index);
  }
}

/** Mọi mảng dài `length` gồm các loại trong [0, kinds). */
function* allArrays(kinds: number, length: number): Generator<number[]> {
  const a = new Array<number>(length).fill(0);
  for (;;) {
    yield [...a];
    let i = length - 1;
    while (i >= 0 && a[i] === kinds - 1) a[i--] = 0;
    if (i < 0) return;
    a[i] = (a[i] as number) + 1;
  }
}

const sortedKey = (a: readonly number[]) => [...a].sort((x, y) => x - y).join();

/**
 * Luật chấm viết lại độc lập với code: có thứ tự thì trùng khít `layers`; Mầm thì cùng tập hợp
 * nhiều phần tử (cùng loại, cùng số lần).
 */
function ruleAccepts(p: StackRecallPuzzle, a: readonly number[]): boolean {
  if (a.length !== p.layers.length) return false;
  return p.ordered ? a.join() === p.layers.join() : sortedKey(a) === sortedKey(p.layers);
}

/** Tháp `t` có đúng luật của mức `d` không (đặc tả, mục Cách sinh câu đố). */
function isValidTower(t: readonly number[], d: Difficulty): boolean {
  const { N, K, repeats } = SPEC[d];
  if (t.length !== N || !t.every((k) => Number.isInteger(k) && k >= 0 && k < K)) return false;
  for (let i = 1; i < t.length; i++) if (t[i] === t[i - 1]) return false;
  const counts = new Map<number, number>();
  for (const k of t) counts.set(k, (counts.get(k) ?? 0) + 1);
  const doubled = [...counts.values()].filter((c) => c === 2).length;
  return [...counts.values()].every((c) => c <= 2) && doubled <= (repeats ? 1 : 0);
}

const hasRepeat = (t: readonly number[]) => new Set(t).size < t.length;

const deviation = (counts: number[]) => {
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  return Math.max(...counts.map((c) => Math.abs(c - mean) / mean));
};

/** Trần trên cho số lần trúng khi xác suất mỗi lần ≤ p: kỳ vọng + 4 độ lệch chuẩn nhị thức. */
const upper = (n: number, p: number) => n * p + 4 * Math.sqrt(n * p * (1 - p));

/**
 * Trần cho số lần gặp của đáp án hay gặp nhất: so cùng lúc tới 16 800 đáp án nên nới thành
 * 5 độ lệch chuẩn + 4 (với kỳ vọng < 1 lần như Siêu khó, giá trị lớn nhất vẫn thường là 5–6).
 */
const upperMax = (n: number, p: number) => n * p + 5 * Math.sqrt(n * p) + 4;

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

// Cả bộ chạy ~3 s; nới hạn mỗi ca cho máy chậm hoặc khi nhiều bộ test chạy song song.
describe("stack-recall", { timeout: 60_000 }, () => {
  it("tất định: sinh hai lần ra giống hệt (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      let mismatches = 0;
      forEachPuzzle(d, (p, roundSeed, index) => {
        const again = stackRecall.generate(roundSeed, index, d);
        if (JSON.stringify(again) !== JSON.stringify(p)) mismatches++;
      });
      expect(mismatches, `mức ${d}`).toBe(0);
    }
  });

  it("tất định giữa các phiên bản: câu đố cố định không đổi", () => {
    // Đổi cách sinh làm hỏng mọi trận đang chạy giữa client cũ và server mới → phải cố ý sửa ở đây.
    expect(stackRecall.generate(777, 5, 0)).toEqual({
      layers: [3, 0],
      tray: [0, 1, 2, 3],
      ordered: false,
      trayShuffled: false,
      showMs: 2_500,
      coverMs: 400,
    });
    expect(stackRecall.generate(777, 5, 3)).toEqual({
      layers: [0, 6, 5, 6, 1],
      tray: [1, 4, 7, 6, 0, 2, 5, 3],
      ordered: true,
      trayShuffled: true,
      showMs: 2_000,
      coverMs: 400,
    });
    expect(stackRecall.generate(0xdeadbeef, 0, 1).layers).toEqual([4, 1, 2]);
    expect(stackRecall.generate(0xdeadbeef, 0, 2).layers).toEqual([2, 4, 1, 5]);
    expect([0, 1, 2, 3, 4, 5].map((i) => stackRecall.generate(42, i, 0).layers)).toEqual([
      [2, 1],
      [3, 1],
      [2, 3],
      [0, 1],
      [3, 2],
      [0, 1],
    ]);
  });

  it("đúng MỘT đáp án theo luật: chỉ tháp (Mầm: hoán vị của nó) được nhận, mọi biến thể đều sai (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const failures: string[] = [];
      const fail = (msg: string, p: StackRecallPuzzle) => {
        if (failures.length < 5) failures.push(`${msg}: ${JSON.stringify(p)}`);
      };

      forEachPuzzle(d, (p) => {
        const exp = p.layers;
        // Mọi mảng thử đều phải được chấm đúng y như luật. `isAnswer` được từ chối mảng sai (vd.
        // dài hơn 5), nhưng không bao giờ được từ chối mảng đúng.
        const agree = (a: number[], what: string) => {
          if (!stackRecall.isAnswer(a)) {
            if (ruleAccepts(p, a)) fail(`isAnswer từ chối đáp án đúng ${what} [${a}]`, p);
          } else if (stackRecall.check(p, a) !== ruleAccepts(p, a)) fail(`${what} [${a}]`, p);
        };

        if (!stackRecall.check(p, [...exp])) fail("không nhận đáp án đúng", p);
        // Mầm: cả hai thứ tự chạm đều đúng; các mức khác chỉ một.
        agree([...exp].reverse(), "xếp ngược");

        for (let i = 0; i < exp.length; i++) {
          // Đổi một tầng sang loại khác (mọi loại của bộ khối, kể cả loại không có trên khay).
          for (let k = 0; k < STACK_RECALL_KINDS.length; k++) {
            if (k === exp[i]) continue;
            const changed = [...exp];
            changed[i] = k;
            agree(changed, `đổi tầng ${i}`);
            if (stackRecall.check(p, changed)) fail(`nhận khi đổi tầng ${i} thành ${k}`, p);
          }
          // Đúng hình dạng client gửi khi chạm sai: các lần chạm còn đúng hướng + một khối lệch.
          // Mảng này luôn phải qua `isAnswer` để server không vứt một lần gửi hợp lệ.
          for (const k of p.tray) {
            const wrongTap = [...exp.slice(0, i), k];
            if (stackRecallOnTrack(p, wrongTap)) continue;
            if (!stackRecall.isAnswer(wrongTap))
              fail(`isAnswer từ chối lần chạm sai ${wrongTap}`, p);
            if (stackRecall.check(p, wrongTap)) fail(`nhận lần chạm sai ${wrongTap}`, p);
          }
        }
        for (let i = 0; i + 1 < exp.length; i++) {
          const swapped = [...exp];
          [swapped[i], swapped[i + 1]] = [exp[i + 1] as number, exp[i] as number];
          agree(swapped, `đổi chỗ tầng ${i}, ${i + 1}`);
        }
        for (let n = 1; n < exp.length; n++) agree(exp.slice(0, n), `tiền tố dài ${n}`);
        for (const k of p.tray) agree([...exp, k], `thêm khối ${k}`);
      });

      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("đúng MỘT đáp án theo luật: duyệt hết mọi cách chạm đủ tầng trên khay (2 500 seed mỗi mức; Siêu khó 100)", () => {
    for (const d of DIFFICULTIES) {
      const { N, K, ordered } = SPEC[d];
      const count = d === 3 ? 100 : 2_500;
      const total = K ** N;
      const a = new Array<number>(N);
      let bad = 0;
      forEachPuzzle(
        d,
        (p) => {
          // Luật viết lại cho nhanh: đếm số lần mỗi loại (Mầm) hoặc so từng tầng (có thứ tự).
          const want = new Array<number>(K).fill(0);
          for (const k of p.layers) want[k] = (want[k] ?? 0) + 1;
          const accepted: number[][] = [];
          for (let code = 0; code < total; code++) {
            let c = code;
            for (let i = N - 1; i >= 0; i--) {
              a[i] = c % K;
              c = Math.floor(c / K);
            }
            let rule = true;
            if (ordered) {
              for (let i = 0; i < N && rule; i++) rule = a[i] === p.layers[i];
            } else {
              const got = new Array<number>(K).fill(0);
              for (const k of a) got[k] = (got[k] ?? 0) + 1;
              rule = got.every((n, k) => n === want[k]);
            }
            const ok = stackRecall.check(p, a);
            if (ok !== rule) bad++;
            if (ok) accepted.push([...a]);
          }
          // Có thứ tự: đúng một dãy. Mầm: đúng một tập hợp, nhận đủ N! thứ tự chạm của nó.
          const sets = new Set(accepted.map(sortedKey));
          if (sets.size !== 1 || !sets.has(sortedKey(p.layers))) bad++;
          if (accepted.length !== (ordered ? 1 : factorial(N))) bad++;
          if (ordered && accepted[0]?.join() !== p.layers.join()) bad++;
          // Đáp án được nhận không bao giờ có hai lần chạm liền nhau cùng loại (client bỏ qua
          // lần chạm trùng loại ngay trước, nên không bao giờ chặn nhầm đáp án đúng).
          for (const a of accepted) if (a.some((k, i) => i > 0 && k === a[i - 1])) bad++;
        },
        count,
      );
      expect(bad, `mức ${d}`).toBe(0);
    }
  });

  it("stackRecallOnTrack: đúng khi và chỉ khi các lần chạm còn nối thành đáp án đúng (vét cạn, 200 seed mỗi mức; Siêu khó 30)", () => {
    for (const d of DIFFICULTIES) {
      const { N, K } = SPEC[d];
      let bad = 0;
      forEachPuzzle(
        d,
        (p) => {
          const completable = new Set<string>();
          for (const a of allArrays(K, N)) {
            if (!ruleAccepts(p, a)) continue;
            for (let n = 0; n <= N; n++) completable.add(a.slice(0, n).join());
          }
          for (let n = 0; n <= N; n++) {
            for (const taps of n === 0 ? [[]] : allArrays(K, n)) {
              if (stackRecallOnTrack(p, taps) !== completable.has(taps.join())) bad++;
            }
          }
          if (stackRecallOnTrack(p, [...p.layers, p.layers[0] as number])) bad++;
        },
        d === 3 ? 30 : 200,
      );
      expect(bad, `mức ${d}`).toBe(0);
    }
  });

  it("đúng mọi ràng buộc của đặc tả, mọi loại trong tháp có trên khay (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const s = SPEC[d];
      const failures: string[] = [];
      const fail = (msg: string, p: StackRecallPuzzle) => {
        if (failures.length < 5) failures.push(`${msg}: ${JSON.stringify(p)}`);
      };
      const canonical = Array.from({ length: s.K }, (_, k) => k);

      forEachPuzzle(d, (p) => {
        if (!isValidTower(p.layers, d)) fail("tháp sai luật của mức", p);
        if (!s.repeats && hasRepeat(p.layers)) fail("có tầng lặp ở mức không cho lặp", p);
        // Khay: đủ K loại, mỗi loại một lần; cố định ở Mầm–Khó, là một hoán vị ở Siêu khó.
        if (p.tray.length !== s.K) fail("khay sai số loại", p);
        if (sortedKey(p.tray) !== canonical.join()) fail("khay không đủ K loại đầu", p);
        if (!s.shuffled && p.tray.join() !== canonical.join()) fail("khay cố định bị đổi chỗ", p);
        if (p.trayShuffled !== s.shuffled) fail("sai cờ xáo khay", p);
        if (p.ordered !== s.ordered) fail("sai cờ thứ tự", p);
        if (!p.layers.every((k) => p.tray.includes(k))) fail("có tầng không có trên khay", p);

        if (p.showMs !== s.showMs || p.coverMs !== 400) fail("lịch khác bảng", p);
        if (!Number.isInteger(p.showMs) || !Number.isInteger(p.coverMs)) {
          fail("thời gian không nguyên", p);
        }
        if (stackRecallRevealMs(p) !== s.revealMs) fail("revealMs khác bảng", p);
      });

      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("bộ khối: 8 loại, mỗi loại khác mọi loại khác ở cả hình lẫn hoa văn", () => {
    expect(STACK_RECALL_KINDS).toHaveLength(8);
    expect(new Set(STACK_RECALL_KINDS.map((k) => k.shape)).size).toBe(8);
    expect(new Set(STACK_RECALL_KINDS.map((k) => k.pattern)).size).toBe(8);
    expect(SPEC[3].K).toBe(STACK_RECALL_KINDS.length);
  });

  it("hai câu liền nhau không bao giờ cùng đáp án (10.000 seed × 4 mức, và 500 vòng 40 câu)", () => {
    for (const d of DIFFICULTIES) {
      const key = (p: StackRecallPuzzle) => (p.ordered ? p.layers.join() : sortedKey(p.layers));
      let same = 0;
      for (let i = 0; i < SEEDS; i++) {
        const seed = roundSeedOf(i);
        const k = i % 20;
        if (key(stackRecall.generate(seed, k, d)) === key(stackRecall.generate(seed, k + 1, d))) {
          same++;
        }
      }
      for (let i = 0; i < 500; i++) {
        const seed = roundSeedOf(SEEDS + i);
        let prev = "";
        for (let k = 0; k < 40; k++) {
          const cur = key(stackRecall.generate(seed, k, d));
          if (cur === prev) same++;
          prev = cur;
        }
      }
      expect(same, `mức ${d}`).toBe(0);
    }
  });

  it("độ khó tăng dần thật, đo được", () => {
    // Số đáp án khác nhau theo luật, đếm thẳng từ luật (không đọc code sinh).
    const space = DIFFICULTIES.map((d) => {
      const answers = new Set<string>();
      for (const t of allArrays(SPEC[d].K, SPEC[d].N)) {
        if (isValidTower(t, d)) answers.add(SPEC[d].ordered ? t.join() : sortedKey(t));
      }
      return answers.size;
    });
    expect(space).toEqual(ANSWER_SPACE);

    const params = DIFFICULTIES.map((d) => {
      const p = stackRecall.generate(1, 0, d);
      return {
        N: p.layers.length,
        K: p.tray.length,
        show: p.showMs,
        msPerLayer: p.showMs / p.layers.length,
        ordered: p.ordered,
        shuffled: p.trayShuffled,
      };
    });
    expect(params.map((x) => x.ordered)).toEqual([false, true, true, true]);
    expect(params.map((x) => x.shuffled)).toEqual([false, false, false, true]);

    // Tỉ lệ câu có tầng lặp, đo trên 10.000 seed: 0, 0, rồi một nửa.
    const repeatRate = DIFFICULTIES.map((d) => {
      let n = 0;
      forEachPuzzle(d, (p) => {
        if (hasRepeat(p.layers)) n++;
      });
      return n / SEEDS;
    });
    expect(repeatRate.slice(0, 2)).toEqual([0, 0]);

    for (let d = 1; d < params.length; d++) {
      const prev = params[d - 1] as (typeof params)[number];
      const cur = params[d] as (typeof params)[number];
      // Không mức nào dễ hơn mức trước ở bất kỳ tham số nào…
      expect(cur.show).toBeLessThanOrEqual(prev.show);
      expect(repeatRate[d] as number).toBeGreaterThanOrEqual((repeatRate[d - 1] as number) - 0.03);
      // …và số tầng, số loại trên khay, thời gian xem mỗi tầng, số đáp án có thể có đều chặt
      // chẽ khó hơn; đoán mò một đáp án cố định thì trúng ít dần.
      expect(cur.N).toBeGreaterThan(prev.N);
      expect(cur.K).toBeGreaterThan(prev.K);
      expect(cur.msPerLayer).toBeLessThan(prev.msPerLayer);
      expect(space[d] as number).toBeGreaterThan(space[d - 1] as number);
      expect(MAX_TOWER_P[d] as number).toBeLessThan(MAX_TOWER_P[d - 1] as number);
    }

    // Bộ sinh phủ được không gian đáp án: Mầm, Thường, Khó thấy đủ mọi đáp án trên 10.000 seed,
    // số đáp án khác nhau thấy được tăng dần theo mức.
    const distinct = DIFFICULTIES.map((d) => {
      const seen = new Set<string>();
      forEachPuzzle(d, (p) => seen.add(p.ordered ? p.layers.join() : sortedKey(p.layers)));
      return seen.size;
    });
    expect(distinct.slice(0, 3)).toEqual([6, 60, 720]);
    expect(distinct[3] as number).toBeGreaterThan(7_000);
  });

  it("không có mẹo đoán: chiến lược đơn giản chỉ trúng ở mức may rủi (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const { N, K, repeats } = SPEC[d];
      const pMax = MAX_TOWER_P[d] as number;
      let leftToRight = 0;
      let rightToLeft = 0;
      let samePrevious = 0;
      let distinctTowers = 0;
      let trayOrdered = 0;
      let repeated = 0;
      const seen = new Map<string, number>();
      const bottomKind = new Array<number>(K).fill(0);
      // slotOf[i][s]: số lần tầng i nằm ở ô khay s.
      const slotOf = Array.from({ length: N }, () => new Array<number>(K).fill(0));
      const pairAt = new Map<string, number>();

      forEachPuzzle(d, (p, roundSeed, index) => {
        const slots = p.layers.map((k) => p.tray.indexOf(k));
        // Chạm khay lần lượt từ trái sang (hoặc từ phải sang) đủ N khối.
        if (stackRecall.check(p, p.tray.slice(0, N))) leftToRight++;
        if (stackRecall.check(p, p.tray.slice(-N).reverse())) rightToLeft++;
        // Chạm lại y đáp án câu trước của cùng vòng.
        const next = stackRecall.generate(roundSeed, index + 1, d);
        if (stackRecall.check(next, p.layers)) samePrevious++;

        const key = p.ordered ? p.layers.join() : sortedKey(p.layers);
        seen.set(key, (seen.get(key) ?? 0) + 1);
        const bottom = p.layers[0] as number;
        bottomKind[bottom] = (bottomKind[bottom] ?? 0) + 1;
        slots.forEach((s, i) => {
          const row = slotOf[i] as number[];
          row[s] = (row[s] ?? 0) + 1;
        });
        if (hasRepeat(p.layers)) {
          repeated++;
          const kind = p.layers.find((k, i) => p.layers.indexOf(k) !== i);
          const at = p.layers.flatMap((k, i) => (k === kind ? [i] : [])).join("-");
          pairAt.set(at, (pairAt.get(at) ?? 0) + 1);
        } else {
          distinctTowers++;
          // Thứ tự khay không lộ thứ tự tháp: tháp "đi theo chiều khay" chỉ ~1/N! số câu.
          if (slots.every((s, i) => i === 0 || s > (slots[i - 1] as number))) trayOrdered++;
        }
      });

      expect(leftToRight, `trái sang phải, mức ${d}`).toBeLessThanOrEqual(upper(SEEDS, pMax));
      expect(rightToLeft, `phải sang trái, mức ${d}`).toBeLessThanOrEqual(upper(SEEDS, pMax));
      expect(Math.max(...seen.values()), `đáp án hay gặp nhất, mức ${d}`).toBeLessThanOrEqual(
        upperMax(SEEDS, pMax),
      );
      expect(samePrevious, `lặp đáp án câu trước, mức ${d}`).toBe(0);

      const pOrdered = 1 / factorial(N);
      const sigma = Math.sqrt(distinctTowers * pOrdered * (1 - pOrdered));
      expect(
        Math.abs(trayOrdered - distinctTowers * pOrdered),
        `theo chiều khay, mức ${d}`,
      ).toBeLessThanOrEqual(4 * sigma);

      // Loại ở tầng đáy, ô khay của từng tầng: đều nhau (lệch ≤ 10 %).
      expect(deviation(bottomKind), `loại tầng đáy, mức ${d}`).toBeLessThanOrEqual(0.1);
      slotOf.forEach((counts, i) => {
        expect(deviation(counts), `ô khay của tầng ${i}, mức ${d}`).toBeLessThanOrEqual(0.1);
      });

      if (repeats) {
        // Nửa số câu có tầng lặp: đoán "luôn có lặp" hay "không bao giờ lặp" đều như tung đồng xu.
        expect(Math.abs(repeated / SEEDS - 0.5), `tỉ lệ lặp, mức ${d}`).toBeLessThanOrEqual(0.03);
        // Cặp tầng lặp ở mọi cặp vị trí không liền nhau, đều nhau.
        const pairs = ((N - 1) * (N - 2)) / 2;
        expect(pairAt.size, `mức ${d}`).toBe(pairs);
        expect(deviation([...pairAt.values()]), `cặp lặp, mức ${d}`).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("check() và stackRecallOnTrack() với ví dụ trong đặc tả", () => {
    // Khó: từ dưới lên tròn · tim · tròn · vuông (tròn lặp, không liền nhau).
    const hard: StackRecallPuzzle = {
      layers: [0, 4, 0, 1],
      tray: [0, 1, 2, 3, 4, 5],
      ordered: true,
      trayShuffled: false,
      showMs: 2_000,
      coverMs: 400,
    };
    expect(stackRecall.check(hard, [0, 4, 0, 1])).toBe(true);
    expect(stackRecall.check(hard, [0, 4, 1, 0])).toBe(false);
    expect(stackRecall.check(hard, [1, 0, 4, 0])).toBe(false);
    expect(stackRecall.check(hard, [0, 4, 0])).toBe(false);
    expect(stackRecall.check(hard, [0, 4, 0, 1, 2])).toBe(false);
    expect(stackRecallOnTrack(hard, [0, 4])).toBe(true);
    expect(stackRecallOnTrack(hard, [0, 4, 1])).toBe(false);
    expect(stackRecallRevealMs(hard)).toBe(2_400);
    expect(stackRecall.speedAllowanceMs?.(hard, 2)).toBe(3_300);

    // Mầm: tam giác + tròn, chạm thứ tự nào cũng được.
    const seedling: StackRecallPuzzle = {
      layers: [2, 0],
      tray: [0, 1, 2, 3],
      ordered: false,
      trayShuffled: false,
      showMs: 2_500,
      coverMs: 400,
    };
    expect(stackRecall.check(seedling, [2, 0])).toBe(true);
    expect(stackRecall.check(seedling, [0, 2])).toBe(true);
    expect(stackRecall.check(seedling, [0, 0])).toBe(false);
    expect(stackRecall.check(seedling, [0, 3])).toBe(false);
    expect(stackRecall.check(seedling, [0])).toBe(false);
    expect(stackRecallOnTrack(seedling, [0])).toBe(true);
    expect(stackRecallOnTrack(seedling, [3])).toBe(false);
    expect(stackRecallOnTrack(seedling, [0, 0])).toBe(false);
  });

  it("isAnswer() nhận mảng hợp lệ, từ chối dữ liệu rác", () => {
    for (const ok of [[0], [7], [0, 2], [0, 4, 1], [6, 3, 0, 1, 0], [3, 3]]) {
      expect(stackRecall.isAnswer(ok), JSON.stringify(ok)).toBe(true);
    }

    const holey: number[] = [];
    holey[1] = 2; // [ <trống>, 2 ]
    const junk: unknown[] = [
      undefined,
      null,
      3,
      "0,2,1",
      true,
      {},
      { length: 1, 0: 1 },
      new Uint8Array([1, 2]),
      [],
      [0, 1, 2, 3, 4, 5],
      [1.5],
      [-1],
      [8],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      ["3"],
      [[1]],
      [null],
      [undefined],
      [true],
      [1, "2"],
      new Array(3),
      holey,
    ];
    for (const bad of junk) {
      expect(stackRecall.isAnswer(bad), String(bad)).toBe(false);
    }
  });

  it("CR-006: vòng 60 s, hệ số theo bảng Cân bằng, không giảm khi lên mức, Thường = 1", () => {
    expect(stackRecall.durationMs).toBe(60_000);
    const m = stackRecall.difficultyMultiplier;
    expect(m).toEqual({ 0: 1, 1: 1, 2: 1.4, 3: 2.2 });
    const values = DIFFICULTIES.map((d) => m?.[d] as number);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("CR-006: speedAllowanceMs = xem + che + 300 ms mỗi lần chạm sau lần đầu, nguyên, tất định (10.000 seed × 4 mức)", () => {
    const allowance = stackRecall.speedAllowanceMs;
    expect(allowance).toBeDefined();
    for (const d of DIFFICULTIES) {
      let bad = 0;
      forEachPuzzle(d, (p, roundSeed, index) => {
        const ms = allowance?.(p, d) as number;
        const again = allowance?.(stackRecall.generate(roundSeed, index, d), d);
        const ok =
          Number.isInteger(ms) &&
          ms >= 0 &&
          ms === again &&
          ms === stackRecallRevealMs(p) + 300 * (p.layers.length - 1) &&
          ms === SPEC[d].allowanceMs &&
          ms < stackRecall.durationMs;
        if (!ok) bad++;
      });
      expect(bad, `mức ${d}`).toBe(0);
    }
  });
});
