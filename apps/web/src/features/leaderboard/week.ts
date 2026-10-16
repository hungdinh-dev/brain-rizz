/**
 * Kỳ "Tuần này" của bảng xếp hạng bắt đầu thứ Hai 00:00 giờ Việt Nam (UC-19, ADR 0011), dù máy
 * người chơi ở múi giờ nào. Chỉ để hiện "Tuần từ thứ Hai 13/10"; việc lọc do RPC trên server.
 */

/** Việt Nam không đổi giờ mùa hè: luôn UTC+7. */
const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * Ngày thứ Hai đầu tuần (giờ VN) chứa thời điểm `now`, trả về Date ở 12:00 UTC của ngày đó để
 * định dạng ngày/tháng ở múi giờ nào cũng ra đúng ngày.
 */
export function vnWeekStart(now: Date): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  // getUTCDay trên giờ đã cộng 7 tiếng = thứ trong tuần ở VN (0 = Chủ nhật).
  const daysSinceMonday = (vn.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - daysSinceMonday, 12),
  );
}

/** Chỉ số màu avatar ổn định theo user_id (bảng xếp hạng không lưu màu). */
export function colorIndexOf(userId: string, colors: number): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (Math.imul(h, 31) + userId.charCodeAt(i)) >>> 0;
  return colors > 0 ? h % colors : 0;
}
