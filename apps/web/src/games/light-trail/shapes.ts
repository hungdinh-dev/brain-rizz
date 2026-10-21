/**
 * Đường vẽ (cú pháp SVG path) dùng chung cho scene và hình minh hoạ màn Hướng dẫn,
 * lấy nguyên từ bản mẫu (canvas Brain Rizz, trang Minigame, khu M2).
 * Mắt và bàn tay dùng chung với game khác: ../_shared/icons.
 */

/** Bóng đèn, tâm (0, 0), cao ~68 đơn vị, vừa ô 176 px của lưới 3×3. */
export const BULB_PATH =
  "M0 -30 C-17 -30 -28 -18 -28 -2 C-28 9 -21 16 -16 21 L-16 28 L16 28 L16 21 C21 16 28 9 28 -2 C28 -18 17 -30 0 -30 Z";
/** Đế bóng đèn: một gạch ngang dưới thân. */
export const BULB_BASE_PATH = "M-10 38 L10 38";

/** Tua ngược (Siêu khó): hai tam giác chỉ sang trái, tâm (0, 0), rộng 42. */
export const REWIND_PATH = "M-1 -16 L-21 0 L-1 16 Z M21 -16 L1 0 L21 16 Z";
