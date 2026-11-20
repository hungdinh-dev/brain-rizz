import { MAX_PLAYERS } from "@brain-rizz/shared";

/**
 * Bố cục theo số ghế (CR-018, ui-ux 6.8): phòng tới 8 ghế giữ đúng bố cục cũ; từ 9 ghế (tính cả
 * bot) các màn dùng bố cục gọn. Tính theo số ghế đang có (`players.length`), không theo `MAX_PLAYERS`.
 * Riêng phòng chờ luôn hiện đủ `MAX_PLAYERS` ô (xem `lobbySlotCount`).
 */

/** Số ghế của bố cục cũ (lưới 4 × 2 ở phòng chờ máy tính). */
export const CLASSIC_SEATS = 8;

/** Phòng đông: từ 9 ghế trở lên thì dùng bố cục gọn. */
export function isCrowded(seats: number): boolean {
  return seats > CLASSIC_SEATS;
}

/**
 * Danh sách cả phòng dùng hàng gọn từ 8 người: màn Hướng dẫn với 8 người (nhiều bot, hàng 2 dòng)
 * đã đẩy nút chính ra khỏi màn đầu ở 1280×800.
 */
export function isCompactRoster(players: number): boolean {
  return players >= CLASSIC_SEATS;
}

/**
 * Số ô của phòng chờ (ghế có người + ô trống): luôn đủ `MAX_PLAYERS` ô, khớp "Người chơi n/12" ở
 * thanh trên, nên chủ phòng thấy ngay còn bao nhiêu chỗ và thêm bot ở bất kỳ ô trống nào.
 * Trước đây tới 7 người chỉ hiện 8 ô (lưới 4 × 2 cũ), người chơi tưởng phòng chỉ có 8 chỗ.
 */
export function lobbySlotCount(players: number): number {
  return Math.max(MAX_PLAYERS, players);
}
