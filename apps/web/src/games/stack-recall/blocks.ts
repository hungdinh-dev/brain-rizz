import type { StackRecallPattern, StackRecallShape } from "@brain-rizz/shared";

/*
 * Hình vẽ của 8 loại khối Xếp lại tháp, dùng chung cho scene (canvas 2D → texture Phaser) và hình
 * minh hoạ màn Hướng dẫn (SVG). Mỗi loại nhận ra bằng HÌNH giữa khối + HOA VĂN nền khối; màu chỉ
 * là gợi ý phụ (đặc tả docs/04-minigames/stack-recall.md, mục "Bộ khối" và "Hiển thị khối").
 * Không import Phaser ở đây: file này nằm trong gói chính cùng hình minh hoạ.
 */

/**
 * Màu gợi ý theo loại (chỉ số = loại khối), là màu thương hiệu có sẵn trong `globals.css`:
 * tròn đỏ cam, vuông xanh dương, tam giác vàng, sao tím, tim hồng, trăng xanh lá, giọt nước xanh
 * ngọc, dấu cộng nâu (gỗ). Khối tròn dùng cam (`identify`) chứ không dùng đỏ để khỏi lẫn màu báo sai.
 */
export const KIND_COLOR_VARS = [
  "--color-identify",
  "--color-analyze",
  "--color-sun",
  "--color-grape",
  "--color-pink",
  "--color-compute",
  "--color-mint",
  "--color-wood",
] as const;

/** Cùng màu như trên, dạng class Tailwind cho SVG (viết đủ chữ để Tailwind quét được). */
export const KIND_FILL_CLASSES = [
  "fill-identify",
  "fill-analyze",
  "fill-sun",
  "fill-grape",
  "fill-pink",
  "fill-compute",
  "fill-mint",
  "fill-wood",
] as const;

/** Làm tròn 1 chữ số thập phân cho chuỗi path gọn. */
const n = (v: number) => String(Math.round(v * 10) / 10);

/** Sao 5 cánh, tâm (0, 0), đẩy xuống 5 đơn vị để cân giữa khung (đỉnh nhọn ở trên). */
function starPath(): string {
  const points: string[] = [];
  for (let k = 0; k < 10; k++) {
    const angle = ((-90 + 36 * k) * Math.PI) / 180;
    const r = k % 2 === 0 ? 50 : 21;
    points.push(`${n(r * Math.cos(angle))} ${n(r * Math.sin(angle) + 5)}`);
  }
  return `M${points.join(" L")} Z`;
}

/** Trăng lưỡi liềm: hình tròn R = 46 khoét bởi hình tròn r = 38 lệch lên phải, dịch cho cân giữa. */
function moonPath(): string {
  const R = 46;
  const r = 38;
  const [cx, cy] = [22, -12];
  const [ox, oy] = [9, 2];
  const d = Math.hypot(cx, cy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const [ux, uy] = [cx / d, cy / d];
  const [bx, by] = [a * ux, a * uy];
  const p1 = `${n(bx - h * uy + ox)} ${n(by + h * ux + oy)}`;
  const p2 = `${n(bx + h * uy + ox)} ${n(by - h * ux + oy)}`;
  return `M${p2} A${R} ${R} 0 1 0 ${p1} A${r} ${r} 0 1 1 ${p2} Z`;
}

/** Hình giữa khối (cú pháp SVG path), khung 100 × 100 tâm (0, 0). */
export const SHAPE_PATHS: Record<StackRecallShape, string> = {
  circle: "M0 -46 A46 46 0 1 1 0 46 A46 46 0 1 1 0 -46 Z",
  square:
    "M-28 -40 L28 -40 Q40 -40 40 -28 L40 28 Q40 40 28 40 L-28 40 Q-40 40 -40 28 L-40 -28 Q-40 -40 -28 -40 Z",
  triangle: "M0 -48 L50 38 L-50 38 Z",
  star: starPath(),
  heart:
    "M0 44 C-8 37 -48 12 -48 -14 C-48 -32 -34 -44 -20 -44 C-10 -44 -3 -38 0 -30 C3 -38 10 -44 20 -44 C34 -44 48 -32 48 -14 C48 12 8 37 0 44 Z",
  moon: moonPath(),
  drop: "M0 -48 C14 -26 38 -4 38 16 C38 36 21 48 0 48 C-21 48 -38 36 -38 16 C-38 -4 -14 -26 0 -48 Z",
  cross:
    "M-15 -46 L15 -46 L15 -15 L46 -15 L46 15 L15 15 L15 46 L-15 46 L-15 15 L-46 15 L-46 -15 L-15 -15 Z",
};

/** Hình chiếm ~70 % chiều cao khối (đặc tả); `SHAPE_PATHS` cao 100 đơn vị. */
export const SHAPE_HEIGHT_RATIO = 0.7;

/** Hoa văn của một khối, toạ độ tâm (0, 0), phủ quá mép khối (người vẽ tự cắt theo khung khối). */
export interface PatternMarks {
  /** Nét kẻ (sọc, răng cưa, sóng, gạch). */
  lines?: string;
  /** Mảng tô (chấm bi, ô ca rô). */
  fills?: string;
  /** Độ dày nét kẻ. */
  width: number;
}

/**
 * Hoa văn của loại cho khối `w × h`. Cỡ hoa văn theo cạnh ngắn của khối nên khối trên tháp,
 * khối ở khay và khối ở cột so sánh cùng một nhịp hoa văn.
 */
export function patternMarks(pattern: StackRecallPattern, w: number, h: number): PatternMarks {
  const u = Math.min(w, h) / 4.4;
  const width = u * 0.26;
  const halfW = w / 2 + u;
  const halfH = h / 2 + u;
  const rows = (pitch: number) => {
    const ys: number[] = [];
    const count = Math.ceil(halfH / pitch);
    for (let k = -count; k <= count; k++) ys.push(k * pitch);
    return ys;
  };

  switch (pattern) {
    case "plain":
      return { width };
    case "stripes":
      return {
        width,
        lines: rows(u)
          .map((y) => `M${n(-halfW)} ${n(y + u / 2)} L${n(halfW)} ${n(y + u / 2)}`)
          .join(" "),
      };
    case "diagonal": {
      const pitch = u * 1.2;
      const parts: string[] = [];
      const reach = halfW + halfH;
      for (let x = -reach; x <= reach; x += pitch) {
        parts.push(`M${n(x - halfH)} ${n(-halfH)} L${n(x + halfH)} ${n(halfH)}`);
      }
      return { width, lines: parts.join(" ") };
    }
    case "dots": {
      const r = u * 0.18;
      const parts: string[] = [];
      rows(u).forEach((y, row) => {
        const shift = row % 2 === 0 ? 0 : u / 2;
        for (let x = -halfW - shift; x <= halfW; x += u) {
          parts.push(
            `M${n(x - r)} ${n(y)} a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0 Z`,
          );
        }
      });
      return { width, fills: parts.join(" ") };
    }
    case "checker": {
      const q = u * 0.95;
      const cols = Math.ceil(halfW / q);
      const rowCount = Math.ceil(halfH / q);
      const parts: string[] = [];
      for (let j = -rowCount; j < rowCount; j++) {
        for (let i = -cols; i < cols; i++) {
          if ((i + j + 2 * (cols + rowCount)) % 2 !== 0) continue;
          parts.push(`M${n(i * q)} ${n(j * q)} h${n(q)} v${n(q)} h${n(-q)} Z`);
        }
      }
      return { width, fills: parts.join(" ") };
    }
    case "zigzag": {
      const step = u * 0.45;
      const amp = u * 0.24;
      const parts = rows(u).map((y) => {
        const points: string[] = [];
        let up = true;
        for (let x = -halfW; x <= halfW + step; x += step) {
          points.push(`${n(x)} ${n(y + (up ? -amp : amp))}`);
          up = !up;
        }
        return `M${points.join(" L")}`;
      });
      return { width, lines: parts.join(" ") };
    }
    case "waves": {
      const half = u * 0.5;
      const amp = u * 0.5;
      const parts = rows(u).map((y) => {
        const count = Math.ceil((2 * halfW) / half) + 1;
        return `M${n(-halfW)} ${n(y)} q${n(half / 2)} ${n(-amp)} ${n(half)} 0${` t${n(half)} 0`.repeat(count)}`;
      });
      return { width, lines: parts.join(" ") };
    }
    case "bricks": {
      const pitch = u * 0.95;
      const brick = u * 1.9;
      const parts: string[] = [];
      rows(pitch).forEach((y, row) => {
        parts.push(`M${n(-halfW)} ${n(y)} L${n(halfW)} ${n(y)}`);
        const shift = row % 2 === 0 ? 0 : brick / 2;
        for (let x = -halfW - shift; x <= halfW; x += brick) {
          parts.push(`M${n(x)} ${n(y)} L${n(x)} ${n(y + pitch)}`);
        }
      });
      return { width, lines: parts.join(" ") };
    }
  }
}

/** Bo góc khối theo đặc tả (16 px ở khối tháp cao 110), thu theo chiều cao khối. */
export function blockRadius(h: number): number {
  return Math.min(16, Math.round((16 * h) / 110));
}
