/** Phép tính nhỏ của mục Tổng quan (hàm thuần, có test). */

/** Đỉnh trục tròn số (1, 2, 2,5, 4, 5 × 10ⁿ) để vạch lưới giữa cũng là số đẹp. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/**
 * So với hôm qua: hôm qua ≥ 10 thì theo %, ít hơn thì theo số (vd. "↓ 2 so với hôm qua").
 * `up`: true tăng, false giảm, null bằng (hoặc chưa có hôm qua).
 */
export function compareToYesterday(today: number, yesterday: number | undefined) {
  if (yesterday === undefined || today === yesterday)
    return { key: "same", n: 0, up: null } as const;
  const up = today > yesterday;
  if (yesterday >= 10) {
    const n = Math.round((Math.abs(today - yesterday) / yesterday) * 100);
    return { key: up ? "upPct" : "downPct", n, up } as const;
  }
  return { key: up ? "upAbs" : "downAbs", n: Math.abs(today - yesterday), up } as const;
}
