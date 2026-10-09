/**
 * Đồng bộ đồng hồ client ↔ server (thuật toán kiểu NTP rút gọn).
 *
 * Client gửi `ping { clientTime: t0 }`, server trả `pong { clientTime: t0, serverTime }`,
 * client ghi nhận `t1` lúc nhận. Lấy mẫu có RTT nhỏ nhất để ước lượng độ lệch.
 */
export interface ClockSample {
  t0: number;
  t1: number;
  serverTime: number;
}

export interface ClockEstimate {
  /** serverTime ≈ Date.now() + offset */
  offset: number;
  rtt: number;
}

export function estimateClock(samples: readonly ClockSample[]): ClockEstimate {
  if (samples.length === 0) return { offset: 0, rtt: 0 };
  let best: ClockSample = samples[0] as ClockSample;
  for (const s of samples) if (s.t1 - s.t0 < best.t1 - best.t0) best = s;
  const rtt = best.t1 - best.t0;
  return { offset: best.serverTime - (best.t0 + rtt / 2), rtt };
}
