/**
 * Đường vẽ (cú pháp SVG path) dùng chung cho scene và hình minh hoạ màn Hướng dẫn,
 * lấy nguyên từ bản mẫu (canvas Brain Rizz, trang Minigame, hàng M10).
 */

/** Mắt mở (pha xem), tâm (0, 0), rộng 76. */
export const EYE_PATH =
  "M-38 0 C-26 -20 -12 -26 0 -26 C12 -26 26 -20 38 0 C26 20 12 26 0 26 C-12 26 -26 20 -38 0 Z";

/** Mắt nhắm (pha che): mí cong + ba hàng mi, tâm (0, 0). */
export const EYE_SHUT_PATH = "M-38 -4 C-26 14 -12 20 0 20 C12 20 26 14 38 -4";
export const EYE_LASH_PATH = "M-24 11 L-31 23 M0 20 L0 34 M24 11 L31 23";

/** Bàn tay chỉ (pha chờ chọn), khung 24×24; đầu ngón trỏ ở (11, 3.5). */
export const HAND_PATH =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/** Huy hiệu đổi chỗ (Siêu khó): hai mũi tên ngược chiều, tâm (0, 0), rộng ~42. */
export const SWAP_LINES_PATH = "M-19 -9 L10 -9 M19 9 L-10 9";
export const SWAP_HEADS_PATH = "M6 -19 L21 -9 L6 1 Z M-6 -1 L-21 9 L-6 19 Z";

/** Dấu tích trong huy hiệu "đúng". */
export const CHECK_PATH = "M-12 1 L-3 10 L13 -9";

/**
 * Rèm che khay, toạ độ tuyệt đối trên khung 720×1280: phủ kín khung khay (648×648, góc (36, 290)),
 * mép dưới lượn sóng.
 */
export const CURTAIN_PATH =
  "M40 286 L680 286 L680 908 C648 936 584 936 552 908 C520 936 456 936 424 908 C392 936 328 936 296 908 C264 936 200 936 168 908 C136 936 72 936 40 908 Z";
/** Nếp sáng (màu hồng nhạt) và nếp tối của rèm. */
export const CURTAIN_LIGHT_PATH =
  "M616 300 L616 880 M488 300 L488 880 M360 300 L360 880 M232 300 L232 880 M104 300 L104 880";
export const CURTAIN_FOLD_PATH =
  "M552 296 C546 500 558 700 552 900 M424 296 C418 500 430 700 424 900 M296 296 C290 500 302 700 296 900 M168 296 C162 500 174 700 168 900";
