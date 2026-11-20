import { MAX_PLAYERS } from "@brain-rizz/shared";

/**
 * Bố cục theo số ghế (CR-018, ui-ux 6.8): phòng tới 8 ghế giữ đúng bố cục cũ; từ 9 ghế (tính cả
 * bot) các màn dùng bố cục gọn. Tính theo số ghế đang có (`players.length`), không theo `MAX_PLAYERS`.
 */

/** Số ghế của bố cục cũ (lưới 4 × 2 ở phòng chờ máy tính). */
export const CLASSIC_SEATS = 8;

/** Phòng đông: từ 9 ghế trở lên thì dùng bố cục gọn. */
export function isCrowded(seats: number): boolean {
  return seats > CLASSIC_SEATS;
}

/**
 * Danh sách cả phòng dùng hàng gọn từ 8 người (cùng ngưỡng 12 ô của phòng chờ): màn Hướng dẫn với
 * 8 người (nhiều bot, hàng 2 dòng) đã đẩy nút chính ra khỏi màn đầu ở 1280×800.
 */
export function isCompactRoster(players: number): boolean {
  return players >= CLASSIC_SEATS;
}

/**
 * Số ô của phòng chờ (ghế có người + ô trống). Tới 7 người: 8 ô như cũ (còn ít nhất một ô trống
 * để mời bạn / thêm bot). Từ 8 người: đủ `MAX_PLAYERS` ô, bố cục gọn, nên chủ phòng vẫn thêm được
 * bot thứ 9–11 ngay trong ô trống.
 */
export function lobbySlotCount(players: number): number {
  return players < CLASSIC_SEATS ? CLASSIC_SEATS : Math.max(MAX_PLAYERS, players);
}
