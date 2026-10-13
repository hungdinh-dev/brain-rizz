/**
 * Đường vẽ (cú pháp SVG path) dùng chung cho scene và hình minh hoạ màn Hướng dẫn,
 * lấy nguyên từ bản mẫu (canvas Brain Rizz, trang Minigame, khu M2).
 */

/** Bóng đèn, tâm (0, 0), cao ~68 đơn vị, vừa ô 176 px của lưới 3×3. */
export const BULB_PATH =
  "M0 -30 C-17 -30 -28 -18 -28 -2 C-28 9 -21 16 -16 21 L-16 28 L16 28 L16 21 C21 16 28 9 28 -2 C28 -18 17 -30 0 -30 Z";
/** Đế bóng đèn: một gạch ngang dưới thân. */
export const BULB_BASE_PATH = "M-10 38 L10 38";

/** Mắt (pha trình chiếu), tâm (0, 0), rộng 76. */
export const EYE_PATH =
  "M-38 0 C-26 -20 -12 -26 0 -26 C12 -26 26 -20 38 0 C26 20 12 26 0 26 C-12 26 -26 20 -38 0 Z";

/** Bàn tay chỉ (pha nhập), khung 24×24; đầu ngón trỏ ở (11, 3.5). */
export const HAND_PATH =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/** Tua ngược (Siêu khó): hai tam giác chỉ sang trái, tâm (0, 0), rộng 42. */
export const REWIND_PATH = "M-1 -16 L-21 0 L-1 16 Z M21 -16 L1 0 L21 16 Z";
