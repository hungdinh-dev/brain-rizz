/**
 * PRNG có seed (mulberry32). Cùng seed → cùng dãy số trên mọi trình duyệt và Node.
 *
 * QUY TẮC: logic sinh câu đố KHÔNG BAO GIỜ được dùng `Math.random()`.
 * Mọi thứ ngẫu nhiên phải đi qua `Rng` để client và server sinh ra cùng một câu đố.
 */
export interface Rng {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [min, max] (bao gồm cả hai đầu). */
  int(min: number, max: number): number;
  /** Chọn ngẫu nhiên một phần tử. */
  pick<T>(items: readonly T[]): T;
  /** Trả về bản sao đã xáo trộn (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("rng.pick: mảng rỗng");
      return items[int(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
  };
}

/**
 * Tạo seed con ổn định cho câu đố thứ `index` của một vòng,
 * để câu 7 luôn giống nhau dù người chơi đi nhanh hay chậm.
 */
export function deriveSeed(roundSeed: number, index: number, salt = 0): number {
  let h = (roundSeed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seed mới cho một vòng chơi — CHỈ server gọi hàm này. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
