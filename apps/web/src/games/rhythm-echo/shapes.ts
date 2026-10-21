/**
 * Đường vẽ (cú pháp SVG path) dùng chung cho scene và hình minh hoạ màn Hướng dẫn của Nhại nhịp.
 * Scene vẽ bằng `Path2D`, hình minh hoạ dùng thẳng trong `<path d>`.
 */

/** Tai (pha nghe), khung 24×24, chỉ có nét — theo biểu tượng `ear` của lucide (giấy phép ISC). */
export const EAR_PATH =
  "M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0 M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4";

/** Loa (khung 24×24) và dấu gạch chéo bên phải loa: "tắt tiếng vẫn chơi được". */
export const SPEAKER_PATH = "M3 9.5 L7 9.5 L12 5 L12 19 L7 14.5 L3 14.5 Z";
export const MUTE_PATH = "M15.5 9.5 L21 15 M21 9.5 L15.5 15";

/** Nốt nhạc móc đơn: thân + móc; đầu nốt là hình elip tâm (0, 0) vẽ riêng. */
export const NOTE_STEM_PATH = "M6 -2 L6 -30 C11 -26 17 -24 17 -15";

/** Tỉ lệ các vòng hoa văn so với bán kính mặt trống. */
export const DRUM_RIM = 0.9;
export const DRUM_RING_OUTER = 0.62;
export const DRUM_RING_INNER = 0.34;
export const DRUM_DOT = 0.1;
/** Số chữ X của dây chéo ở viền trống phải. */
export const DRUM_LACES = 8;

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(2));

/**
 * Hoa văn trống phải: dây chéo hình chữ X giữa vòng `inner` và vòng `outer` (tâm 0, 0), `count`
 * chữ X đều quanh mặt trống, chữ đầu tiên ở đỉnh.
 */
export function lacePath(outer: number, inner: number, count = DRUM_LACES): string {
  const point = (r: number, a: number) => `${fmt(r * Math.cos(a))} ${fmt(r * Math.sin(a))}`;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * 2 * Math.PI - Math.PI / 2 - Math.PI / count;
    const a1 = a0 + (2 * Math.PI) / count;
    parts.push(
      `M${point(outer, a0)} L${point(inner, a1)}`,
      `M${point(inner, a0)} L${point(outer, a1)}`,
    );
  }
  return parts.join(" ");
}
