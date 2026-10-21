import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, type Rng } from "../../rng";
import {
  RHYTHM_ECHO_DEBOUNCE_MS,
  type RhythmEchoHit,
  type RhythmEchoPuzzle,
  type RhythmEchoSide,
  rhythmEcho,
  rhythmEchoFirstMiss,
  rhythmEchoListenMs,
  rhythmEchoNextWindow,
  rhythmEchoSpanMs,
} from "./rhythm-echo";

const SEEDS = 10_000;
/** Ca nặng (duyệt mọi dãy mặt trống, mọi biến thể) chia đều 10.000 seed cho 4 mức. */
const SEEDS_PER_LEVEL = SEEDS / DIFFICULTIES.length;

/** Bảng Độ khó của đặc tả, chép lại độc lập với code để test bắt được chỗ lệch. */
const SPEC: Record<
  Difficulty,
  {
    drums: 1 | 2;
    hitCounts: number[];
    tolMs: number;
    units: number[];
    gapUnits: number[];
    maxSpanUnits: number;
    minSwitches: number;
  }
> = {
  0: {
    drums: 1,
    hitCounts: [3],
    tolMs: 150,
    units: [250, 275, 300, 325, 350, 375, 400],
    gapUnits: [2],
    maxSpanUnits: 4,
    minSwitches: 0,
  },
  1: {
    drums: 2,
    hitCounts: [4],
    tolMs: 120,
    units: [200, 225, 250, 275, 300, 325, 350],
    gapUnits: [2],
    maxSpanUnits: 6,
    minSwitches: 1,
  },
  2: {
    drums: 2,
    hitCounts: [5, 6],
    tolMs: 100,
    units: [260, 280, 300],
    gapUnits: [1, 2, 4],
    maxSpanUnits: 10,
    minSwitches: 1,
  },
  3: {
    drums: 2,
    hitCounts: [6],
    tolMs: 80,
    units: [260, 280],
    gapUnits: [1, 2, 3, 4],
    maxSpanUnits: 10,
    minSwitches: 2,
  },
};

const LEAD_MS = 500;
const TAIL_MS = 400;
/** Khoảng cách ngắn nhất giữa hai tiếng, và chênh lệch nhỏ nhất giữa hai loại khoảng cách. */
const minSeparation = (tolMs: number) => 2 * tolMs + 60;

/**
 * Seed vòng thứ i: trải khắp 32 bit thay vì chỉ 0…9 999. Không nhân với 0x9e3779b1 như
 * `deriveSeed`: `(i + 1) · 0x9e3779b1` XOR với phần chỉ số câu triệt tiêu, 20 câu đầu trùng nhau.
 */
const roundSeedOf = (i: number) => (Math.imul(i, 0x27d4eb2f) + 0x165667b1) >>> 0;

function forEachPuzzle(
  d: Difficulty,
  count: number,
  fn: (p: RhythmEchoPuzzle, roundSeed: number, index: number) => void,
) {
  for (let i = 0; i < count; i++) {
    const roundSeed = roundSeedOf(i);
    const index = i % 20;
    fn(rhythmEcho.generate(roundSeed, index, d), roundSeed, index);
  }
}

const hitAt = (p: RhythmEchoPuzzle, k: number) => p.hits[k] as RhythmEchoHit;
/** Khoảng cách (ms) giữa tiếng k−1 và k, k = 1…N−1. */
const gapsOf = (hits: readonly RhythmEchoHit[]) =>
  hits.slice(1).map((h, k) => h.atMs - (hits[k] as RhythmEchoHit).atMs);
/** Dựng đáp án từ tiếng đầu `start` và dãy khoảng cách. */
function build(sides: readonly RhythmEchoSide[], start: number, gaps: readonly number[]) {
  const out: RhythmEchoHit[] = [];
  let at = start;
  sides.forEach((side, k) => {
    if (k > 0) at += gaps[k - 1] as number;
    out.push({ side, atMs: at });
  });
  return out;
}
const sidesOf = (hits: readonly RhythmEchoHit[]) => hits.map((h) => h.side);
const flip = (s: RhythmEchoSide): RhythmEchoSide => (s === "left" ? "right" : "left");

/** Số tiếng nghịch phách (tiếng ở nửa phách mà phách kế không có tiếng), tính lại độc lập. */
function syncopationsOf(p: RhythmEchoPuzzle): number {
  const units = gapsOf(p.hits).map((g) => g / p.unitMs);
  let pos = 0;
  let count = 0;
  for (let k = 0; k < units.length - 1; k++) {
    pos += units[k] as number;
    if (pos % 2 === 1 && (units[k + 1] as number) >= 2) count++;
  }
  return count;
}

function normal(rng: Rng): number {
  const u = Math.max(1e-12, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/**
 * Người gõ "giả" cố định cho mọi mức (đúng mặt, chỉ sai nhịp): nhịp nhanh/chậm cả câu ±4 %
 * (độ lệch chuẩn), mỗi khoảng lệch thêm 4 %, khoảng dài/ngắn bị kéo 5 % về khoảng trung bình,
 * mỗi lần chạm lệch 15 ms. Dùng để đo độ khó tăng dần thật sự.
 */
function noisyTaps(p: RhythmEchoPuzzle, rng: Rng): RhythmEchoHit[] {
  const gaps = gapsOf(p.hits);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const tempo = 1 + 0.04 * normal(rng);
  let clock = 0;
  const raw = p.hits.map((h, k) => {
    if (k > 0) {
      const g = (gaps[k - 1] as number) + 0.05 * (mean - (gaps[k - 1] as number));
      clock += g * tempo + 0.04 * g * normal(rng);
    }
    return { side: h.side, at: clock + 15 * normal(rng) };
  });
  const t0 = raw[0]?.at ?? 0;
  let prev = 0;
  return raw.map(({ side, at }) => {
    prev = Math.max(prev, Math.round(at - t0));
    return { side, atMs: prev };
  });
}

describe("rhythm-echo", () => {
  it("tất định: sinh hai lần ra giống hệt (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      let mismatches = 0;
      forEachPuzzle(d, SEEDS, (p, roundSeed, index) => {
        const again = rhythmEcho.generate(roundSeed, index, d);
        if (JSON.stringify(again) !== JSON.stringify(p)) mismatches++;
      });
      expect(mismatches).toBe(0);
    }
  });

  it("câu cố định (seed 777, câu 5): đổi cách sinh câu đố phải là cố ý", () => {
    const L = "left" as const;
    const R = "right" as const;
    const hits = (sides: RhythmEchoSide[], at: number[]) =>
      sides.map((side, k) => ({ side, atMs: at[k] as number }));
    expect(rhythmEcho.generate(777, 5, 0)).toEqual({
      drums: 1,
      hits: hits([L, L, L], [0, 700, 1400]),
      tolMs: 150,
      unitMs: 350,
      leadMs: 500,
      tailMs: 400,
    });
    expect(rhythmEcho.generate(777, 5, 1)).toEqual({
      drums: 2,
      hits: hits([R, R, R, L], [0, 600, 1200, 1800]),
      tolMs: 120,
      unitMs: 300,
      leadMs: 500,
      tailMs: 400,
    });
    expect(rhythmEcho.generate(777, 5, 2)).toEqual({
      drums: 2,
      hits: hits([L, R, R, R, R, L], [0, 560, 1680, 1960, 2240, 2800]),
      tolMs: 100,
      unitMs: 280,
      leadMs: 500,
      tailMs: 400,
    });
    expect(rhythmEcho.generate(777, 5, 3)).toEqual({
      drums: 2,
      hits: hits([R, L, R, R, R, L], [0, 560, 840, 1400, 2520, 2800]),
      tolMs: 80,
      unitMs: 280,
      leadMs: 500,
      tailMs: 400,
    });
  });

  it("đúng bảng Độ khó: số trống, số tiếng, dung sai, đơn vị nhịp, mặt trống (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      const bad: string[] = [];
      forEachPuzzle(d, SEEDS, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const n = p.hits.length;
        if (p.drums !== spec.drums) bad.push(`${where}: drums ${p.drums}`);
        if (!spec.hitCounts.includes(n)) bad.push(`${where}: ${n} tiếng`);
        if (p.tolMs !== spec.tolMs) bad.push(`${where}: tolMs ${p.tolMs}`);
        if (!spec.units.includes(p.unitMs)) bad.push(`${where}: unitMs ${p.unitMs}`);
        if (p.leadMs !== LEAD_MS || p.tailMs !== TAIL_MS) bad.push(`${where}: lead/tail`);
        if (hitAt(p, 0).atMs !== 0) bad.push(`${where}: tiếng đầu không ở 0`);
        for (const h of p.hits) {
          if (!Number.isInteger(h.atMs)) bad.push(`${where}: atMs không nguyên`);
          if (h.side !== "left" && h.side !== "right") bad.push(`${where}: side ${h.side}`);
        }
        const units = gapsOf(p.hits).map((g) => g / p.unitMs);
        if (!units.every((u) => spec.gapUnits.includes(u))) bad.push(`${where}: khoảng ${units}`);
        if (units.reduce((a, b) => a + b, 0) > spec.maxSpanUnits) bad.push(`${where}: câu quá dài`);
        const sides = sidesOf(p.hits);
        if (spec.drums === 1) {
          // Mầm: một trống, mọi tiếng là "left".
          if (!sides.every((s) => s === "left")) bad.push(`${where}: Mầm có tiếng "right"`);
        } else {
          let switches = 0;
          for (let k = 1; k < n; k++) if (sides[k] !== sides[k - 1]) switches++;
          if (switches < spec.minSwitches) bad.push(`${where}: ${switches} lần đổi mặt`);
        }
      });
      expect(bad.slice(0, 5)).toEqual([]);
    }
  });

  it("luật câu nhịp từng mức: đều / có nghỉ + nốt ngắn đi đôi / nghịch phách (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const bad: string[] = [];
      forEachPuzzle(d, SEEDS, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const units = gapsOf(p.hits).map((g) => g / p.unitMs);
        const runs = units
          .join("")
          .split(/[^1]+/)
          .filter((r) => r.length > 0)
          .map((r) => r.length);
        const sync = syncopationsOf(p);
        if (d <= 1 && !units.every((u) => u === 2)) bad.push(`${where}: không đều`);
        if (d === 2) {
          if (runs.length === 0 || !runs.every((r) => r === 2)) bad.push(`${where}: nốt ngắn lẻ`);
          if (!units.includes(4)) bad.push(`${where}: không có chỗ nghỉ`);
        }
        if (d === 3 && runs.some((r) => r > 2)) bad.push(`${where}: 3 nốt ngắn liền`);
        if (d <= 2 && sync !== 0) bad.push(`${where}: có nghịch phách`);
        if (d === 3 && sync < 1) bad.push(`${where}: không nghịch phách`);
      });
      expect(bad.slice(0, 5)).toEqual([]);
    }
  });

  it("khoảng cách tối thiểu: ≥ 2·tolMs + 60 ms, các loại khoảng cách cách nhau ≥ 2·tolMs + 60 ms, ≤ 3 tiếng mỗi giây", () => {
    for (const d of DIFFICULTIES) {
      const bad: string[] = [];
      let smallest = Number.POSITIVE_INFINITY;
      forEachPuzzle(d, SEEDS, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const sep = minSeparation(p.tolMs);
        const gaps = gapsOf(p.hits);
        smallest = Math.min(smallest, ...gaps);
        if (Math.min(...gaps) < sep) bad.push(`${where}: khoảng ${Math.min(...gaps)} < ${sep}`);
        // Khung chấm đúng của hai loại khoảng cách khác nhau không bao giờ chạm nhau (cách ≥ 60 ms),
        // nên mỗi lần gõ chỉ có thể khớp một độ dài nốt.
        const kinds = [...new Set(gaps)].sort((a, b) => a - b);
        for (let i = 1; i < kinds.length; i++) {
          if ((kinds[i] as number) - (kinds[i - 1] as number) < sep) bad.push(`${where}: ${kinds}`);
        }
        // WCAG 2.3.1: không quá 3 lần nháy trong một giây bất kỳ.
        for (let k = 0; k + 3 < p.hits.length; k++) {
          if (hitAt(p, k + 3).atMs - hitAt(p, k).atMs <= 1_000) bad.push(`${where}: 4 tiếng/1 s`);
        }
      });
      expect(bad.slice(0, 5)).toEqual([]);
      // Chốt số đã ghi trong đặc tả: khoảng ngắn nhất từng mức.
      expect(smallest).toBe([500, 400, 260, 260][d]);
    }
  });

  it("đúng một đáp án: chỉ một dãy mặt trống được nhận; dời cả câu hay lệch ≤ tol vẫn đúng; lệch > tol, thiếu, thừa đều sai (10.000 seed chia đều 4 mức)", () => {
    const rng = createRng(20261020);
    for (const d of DIFFICULTIES) {
      const bad: string[] = [];
      forEachPuzzle(d, SEEDS_PER_LEVEL, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const n = p.hits.length;
        const sides = sidesOf(p.hits);
        const gaps = gapsOf(p.hits);
        const tol = p.tolMs;
        const ok = (a: RhythmEchoHit[]) => rhythmEcho.isAnswer(a) && rhythmEcho.check(p, a);

        // Đáp án tham chiếu = chính `hits`.
        if (!ok(p.hits)) bad.push(`${where}: hits bị chấm sai`);
        // Dời toàn bộ.
        for (const shift of [1, 137, 5_000]) {
          if (!ok(build(sides, shift, gaps))) bad.push(`${where}: dời ${shift} bị sai`);
        }
        // Mỗi khoảng lệch đúng ±tol (dấu ngẫu nhiên), và lệch ngẫu nhiên trong ±tol.
        const edge = gaps.map((g) => g + (rng.next() < 0.5 ? -tol : tol));
        if (!ok(build(sides, 0, edge))) bad.push(`${where}: lệch đúng ±tol bị sai`);
        const inside = gaps.map((g) => g + rng.int(-tol, tol));
        if (!ok(build(sides, rng.int(0, 300), inside))) bad.push(`${where}: lệch trong tol bị sai`);
        // Một khoảng bất kỳ lệch tol + 1 → sai.
        for (let k = 0; k < gaps.length; k++) {
          for (const delta of [-(tol + 1), tol + 1]) {
            const g = gaps.map((x, j) => (j === k ? x + delta : x));
            if (rhythmEcho.check(p, build(sides, 0, g)))
              bad.push(`${where}: khoảng ${k} lệch ${delta}`);
          }
        }
        // Mọi dãy mặt trống khác (kể cả "right" ở Mầm) với nhịp đúng khít → sai: đúng MỘT dãy được nhận.
        let accepted = 0;
        for (let mask = 0; mask < 1 << n; mask++) {
          const s = sides.map((_, k): RhythmEchoSide => ((mask >> k) & 1 ? "right" : "left"));
          if (rhythmEcho.check(p, build(s, 0, gaps))) accepted++;
        }
        if (accepted !== 1) bad.push(`${where}: ${accepted} dãy mặt trống được nhận`);
        // Thiếu tiếng (mọi tiền tố ngắn hơn), thừa một tiếng, bỏ một tiếng ở giữa → sai.
        for (let len = 1; len < n; len++) {
          if (rhythmEcho.check(p, p.hits.slice(0, len))) bad.push(`${where}: tiền tố ${len} đúng`);
        }
        const last = hitAt(p, n - 1);
        for (const side of ["left", "right"] as const) {
          const extra = [...p.hits, { side, atMs: last.atMs + (gaps[0] as number) }];
          if (rhythmEcho.check(p, extra)) bad.push(`${where}: thừa tiếng vẫn đúng`);
        }
        for (let k = 1; k < n - 1; k++) {
          const dropped = p.hits.filter((_, j) => j !== k);
          if (rhythmEcho.check(p, dropped)) bad.push(`${where}: bỏ tiếng ${k} vẫn đúng`);
        }
        // Đổi chỗ hai khoảng liền nhau khác nhau (nhầm nhịp) → sai.
        for (let k = 0; k + 1 < gaps.length; k++) {
          if (gaps[k] === gaps[k + 1]) continue;
          const g = [...gaps];
          [g[k], g[k + 1]] = [g[k + 1] as number, g[k] as number];
          if (rhythmEcho.check(p, build(sides, 0, g)))
            bad.push(`${where}: đổi khoảng ${k} vẫn đúng`);
        }
      });
      expect(bad.slice(0, 5)).toEqual([]);
    }
  });

  it("rhythmEchoFirstMiss và rhythmEchoNextWindow khớp với check (client chấm như server)", () => {
    const rng = createRng(7);
    for (const d of DIFFICULTIES) {
      const bad: string[] = [];
      forEachPuzzle(d, SEEDS_PER_LEVEL, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const n = p.hits.length;
        // Đáp án lệch ngẫu nhiên tới 1,5 × tol, đôi khi sai mặt: check ⇔ đủ tiếng và không có lần sai.
        const gaps = gapsOf(p.hits).map((g) => g + rng.int(-1.5 * p.tolMs, 1.5 * p.tolMs));
        const sides = sidesOf(p.hits).map((s) => (rng.next() < 0.05 ? flip(s) : s));
        const taps = build(sides, 0, gaps);
        const miss = rhythmEchoFirstMiss(p, taps);
        if (rhythmEcho.check(p, taps) !== (miss === -1)) bad.push(`${where}: check ≠ firstMiss`);
        if (miss !== -1 && rhythmEchoFirstMiss(p, taps.slice(0, miss)) !== -1) {
          bad.push(`${where}: tiền tố trước lần sai vẫn có lần sai`);
        }
        // Khung lần gõ kế: hai đầu được nhận, ra ngoài 1 ms là sai ngay ở lần gõ đó.
        if (rhythmEchoNextWindow(p, []) !== undefined) bad.push(`${where}: lần đầu có hạn`);
        if (rhythmEchoNextWindow(p, p.hits) !== undefined) bad.push(`${where}: đủ rồi vẫn có hạn`);
        for (let k = 1; k < n; k++) {
          const before = p.hits.slice(0, k);
          const w = rhythmEchoNextWindow(p, before);
          if (!w) {
            bad.push(`${where}: thiếu khung ${k}`);
            continue;
          }
          const side = hitAt(p, k).side;
          const at = (atMs: number) => rhythmEchoFirstMiss(p, [...before, { side, atMs }]);
          if (at(w.fromMs) !== -1 || at(w.toMs) !== -1)
            bad.push(`${where}: biên khung ${k} bị sai`);
          if (at(w.fromMs - 1) !== k || at(w.toMs + 1) !== k)
            bad.push(`${where}: ngoài khung ${k}`);
          if (w.toMs - w.fromMs !== 2 * p.tolMs) bad.push(`${where}: khung ${k} rộng sai`);
        }
      });
      expect(bad.slice(0, 5)).toEqual([]);
    }
  });

  it("bộ lọc chạm nảy (RHYTHM_ECHO_DEBOUNCE_MS) không bao giờ chặn nhầm một lần gõ đúng", () => {
    for (const d of DIFFICULTIES) {
      let minAccepted = Number.POSITIVE_INFINITY;
      forEachPuzzle(d, SEEDS, (p) => {
        for (const g of gapsOf(p.hits)) minAccepted = Math.min(minAccepted, g - p.tolMs);
      });
      expect(minAccepted).toBeGreaterThan(RHYTHM_ECHO_DEBOUNCE_MS);
    }
  });

  it("độ khó tăng dần, đo được (10.000 seed × 4 mức)", () => {
    const stats = DIFFICULTIES.map((d) => {
      const rng = createRng(99 + d);
      let hits = 0;
      let sync = 0;
      let offbeat = 0;
      let kinds = 0;
      let passed = 0;
      const distinct = new Set<string>();
      forEachPuzzle(d, SEEDS, (p) => {
        hits += p.hits.length;
        sync += syncopationsOf(p);
        kinds += new Set(gapsOf(p.hits)).size;
        let pos = 0;
        for (const g of gapsOf(p.hits)) {
          pos += g / p.unitMs;
          if (pos % 2 === 1) offbeat++;
        }
        distinct.add(JSON.stringify(p.hits));
        if (rhythmEcho.check(p, noisyTaps(p, rng))) passed++;
      });
      return {
        tol: SPEC[d].tolMs,
        hits: hits / SEEDS,
        sync: sync / SEEDS,
        offbeat: offbeat / hits,
        kinds: kinds / SEEDS,
        distinct: distinct.size,
        pass: passed / SEEDS,
      };
    });
    for (let d = 1; d < stats.length; d++) {
      const prev = stats[d - 1] as (typeof stats)[number];
      const cur = stats[d] as (typeof stats)[number];
      expect(cur.tol).toBeLessThan(prev.tol);
      expect(cur.hits).toBeGreaterThan(prev.hits);
      expect(cur.distinct).toBeGreaterThan(prev.distinct);
      expect(cur.kinds).toBeGreaterThanOrEqual(prev.kinds);
      expect(cur.offbeat).toBeGreaterThanOrEqual(prev.offbeat);
      // Cùng một người gõ giả, mức sau luôn khó qua hơn mức trước.
      expect(cur.pass).toBeLessThan(prev.pass);
    }
    // Nghịch phách chỉ có ở Siêu khó; nốt ở nửa phách chỉ từ Khó.
    expect(stats.map((s) => s.sync > 0)).toEqual([false, false, false, true]);
    expect(stats.map((s) => s.offbeat > 0)).toEqual([false, false, true, true]);
  });

  it("isAnswer nhận mọi đáp án client hợp lệ có thể gửi", () => {
    for (const d of DIFFICULTIES) {
      const bad: string[] = [];
      forEachPuzzle(d, SEEDS_PER_LEVEL, (p, roundSeed, index) => {
        const where = `d${d} seed ${roundSeed} câu ${index}`;
        const n = p.hits.length;
        if (!rhythmEcho.isAnswer(p.hits)) bad.push(`${where}: hits`);
        for (let len = 1; len <= n; len++) {
          const prefix = p.hits.slice(0, len);
          if (!rhythmEcho.isAnswer(prefix)) bad.push(`${where}: tiền tố ${len}`);
          // Tiền tố đúng + một lần gõ sai mặt (hình dạng client gửi khi sai).
          if (len < n) {
            const wrong = { side: flip(hitAt(p, len).side), atMs: hitAt(p, len).atMs };
            if (!rhythmEcho.isAnswer([...prefix, wrong])) bad.push(`${where}: sai ở ${len}`);
          }
        }
      });
      expect(bad.slice(0, 5)).toEqual([]);
    }
    // Hai lần gõ cùng ms (hai ngón chạm cùng lúc) vẫn hợp lệ để server không bỏ qua câu; check chấm sai.
    const p = rhythmEcho.generate(777, 5, 1);
    const same = [
      { side: "right" as const, atMs: 0 },
      { side: "right" as const, atMs: 0 },
    ];
    expect(rhythmEcho.isAnswer(same)).toBe(true);
    expect(rhythmEcho.check(p, same)).toBe(false);
  });

  it("isAnswer từ chối dữ liệu rác", () => {
    const ok = { side: "left", atMs: 0 };
    const tap = (side: unknown, atMs: unknown) => ({ side, atMs });
    const sparse: unknown[] = [ok];
    sparse[2] = tap("left", 500);
    const garbage: unknown[] = [
      undefined,
      null,
      0,
      "[]",
      {},
      { 0: ok, length: 1 },
      [],
      Array.from({ length: 7 }, (_, k) => tap("left", k * 300)),
      [null],
      [[]],
      ["left"],
      [0],
      [tap("up", 0)],
      [tap("", 0)],
      [tap(0, 0)],
      [tap("LEFT", 0)],
      [{ atMs: 0 }],
      [{ side: "left" }],
      [tap("left", -1)],
      [tap("left", 1.5)],
      [tap("left", "100")],
      [tap("left", Number.NaN)],
      [tap("left", Number.POSITIVE_INFINITY)],
      [tap("left", 60_001)],
      [tap("left", 500), tap("right", 499)],
      [ok, tap("right", 400), tap("left", 300)],
      sparse,
    ];
    for (const value of garbage) expect(rhythmEcho.isAnswer(value)).toBe(false);
    expect(rhythmEcho.isAnswer([ok])).toBe(true);
    expect(rhythmEcho.isAnswer([tap("right", 60_000)])).toBe(true);
    expect(rhythmEcho.isAnswer(Array.from({ length: 6 }, (_, k) => tap("left", k * 300)))).toBe(
      true,
    );
  });

  it("speedAllowanceMs = pha nghe + độ dài câu nhịp: nguyên, tất định, nhỏ hơn vòng", () => {
    for (const d of DIFFICULTIES) {
      let lo = Number.POSITIVE_INFINITY;
      let hi = 0;
      forEachPuzzle(d, SEEDS, (p, roundSeed, index) => {
        const allowance = rhythmEcho.speedAllowanceMs?.(p, d) ?? -1;
        const span = rhythmEchoSpanMs(p);
        const listen = rhythmEchoListenMs(p);
        expect(span).toBe(hitAt(p, p.hits.length - 1).atMs);
        expect(listen).toBe(LEAD_MS + span + TAIL_MS);
        expect(allowance).toBe(listen + span);
        expect(Number.isInteger(allowance)).toBe(true);
        expect(allowance).toBe(
          rhythmEcho.speedAllowanceMs?.(rhythmEcho.generate(roundSeed, index, d), d),
        );
        lo = Math.min(lo, allowance);
        hi = Math.max(hi, allowance);
      });
      // Khoảng ghi trong bảng Cân bằng của đặc tả.
      expect([lo, hi]).toEqual(
        [
          [2_900, 4_100],
          [3_300, 5_100],
          [5_060, 6_900],
          [4_540, 6_500],
        ][d],
      );
      expect(hi).toBeLessThan(rhythmEcho.durationMs);
    }
  });

  it("hệ số điểm không giảm khi lên mức, không khai báo hạn trả lời", () => {
    const m = rhythmEcho.difficultyMultiplier;
    expect(m).toEqual({ 0: 1, 1: 1, 2: 2.45, 3: 2.7 });
    for (let d = 1; d < DIFFICULTIES.length; d++) {
      expect(m?.[d as Difficulty]).toBeGreaterThanOrEqual(m?.[(d - 1) as Difficulty] ?? 0);
    }
    expect(rhythmEcho.answerWindowMs).toBeUndefined();
    expect(rhythmEcho.durationMs).toBe(60_000);
    expect(rhythmEcho.category).toBe("memorize");
  });
});
