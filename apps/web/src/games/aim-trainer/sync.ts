/*
 * Phần thuần của Luyện ngắm khi đồng bộ với server (tách khỏi scene để test): đếm chip
 * "trúng + ms TB". Chọn cách hiện lại câu sau khi nối lại / khi server bỏ qua một câu dùng chung
 * với game khác: ../_shared/resync.
 */

/**
 * Chip "trúng + ms TB" chỉ đếm câu server đã chấm ĐÚNG (`answerResult`), không đếm lúc máy thấy
 * trúng: cú trúng bị chấm muộn, hay gửi tiếp lúc server đang khoá (bị bỏ qua), không được cộng.
 * Khoá theo index câu nên một câu chỉ được đếm một lần (server chỉ chấm mỗi câu một lần trong vòng).
 * ms là đồng hồ scene lúc chạm (chỉ để hiển thị).
 */
export class HitTally {
  private confirmed = new Map<number, number>();

  /** Server chấm đúng câu `index`, chạm sau `ms` kể từ lúc bia hiện. */
  confirm(index: number, ms: number) {
    if (!this.confirmed.has(index)) this.confirmed.set(index, Math.max(0, Math.round(ms)));
  }

  get hits(): number {
    return this.confirmed.size;
  }

  /** ms trung bình mỗi bia trúng; `undefined` khi chưa trúng bia nào. */
  get avgMs(): number | undefined {
    if (this.confirmed.size === 0) return undefined;
    let sum = 0;
    for (const ms of this.confirmed.values()) sum += ms;
    return Math.round(sum / this.confirmed.size);
  }
}
