/**
 * Đường vẽ (cú pháp SVG path) dùng chung cho scene và hình minh hoạ màn Hướng dẫn,
 * lấy nguyên từ bản mẫu (canvas Brain Rizz, trang Minigame, hàng M10). Mắt, bàn tay, huy hiệu đổi
 * chỗ và dấu tích: ../_shared/icons.
 */

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
