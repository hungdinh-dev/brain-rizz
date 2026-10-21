/**
 * Biểu tượng pha dùng chung giữa nhiều game (cú pháp SVG path, cho cả scene lẫn hình minh hoạ màn
 * Hướng dẫn): mắt = pha xem/trình chiếu, mắt nhắm = pha che, bàn tay = pha chạm/nhập. Lấy nguyên từ
 * bản mẫu (canvas Brain Rizz, trang Minigame, khu M2 và hàng M10).
 */

/** Mắt mở (pha xem), tâm (0, 0), rộng 76. */
export const EYE_PATH =
  "M-38 0 C-26 -20 -12 -26 0 -26 C12 -26 26 -20 38 0 C26 20 12 26 0 26 C-12 26 -26 20 -38 0 Z";

/** Mắt nhắm (pha che): mí cong + ba hàng mi, tâm (0, 0). */
export const EYE_SHUT_PATH = "M-38 -4 C-26 14 -12 20 0 20 C12 20 26 14 38 -4";
export const EYE_LASH_PATH = "M-24 11 L-31 23 M0 20 L0 34 M24 11 L31 23";

/** Bàn tay chỉ (pha chạm), khung 24×24; đầu ngón trỏ ở (11, 3.5). */
export const HAND_PATH =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/** Huy hiệu đổi chỗ (Siêu khó): hai mũi tên ngược chiều, tâm (0, 0), rộng ~42. */
export const SWAP_LINES_PATH = "M-19 -9 L10 -9 M19 9 L-10 9";
export const SWAP_HEADS_PATH = "M6 -19 L21 -9 L6 1 Z M-6 -1 L-21 9 L-6 19 Z";

/** Dấu tích trong huy hiệu "đúng". */
export const CHECK_PATH = "M-12 1 L-3 10 L13 -9";
