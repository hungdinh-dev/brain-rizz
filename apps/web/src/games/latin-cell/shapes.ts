/*
 * Bảng hình của Ô bí ẩn (mục "Bảng hình" trong docs/04-minigames/latin-cell.md), dùng chung cho
 * scene Phaser và hình minh hoạ SVG. Mã hình cố định: 0 tròn, 1 tam giác, 2 vuông, 3 sao,
 * 4 chữ thập, 5 trăng. Sáu hình khác nhau ở DÁNG (in đen trắng vẫn nhận ra); màu chỉ là phụ.
 *
 * Toạ độ theo đơn vị: hình nằm gọn trong hình tròn bán kính ~1 quanh (0, 0), đã căn giữa theo
 * khung bao. Nơi vẽ nhân với bán kính thật (scene: 30 % cạnh ô, tức hình rộng ~60 % ô).
 */

export type Point = readonly [number, number];

export type ShapeGeometry =
  | { kind: "circle"; r: number }
  | {
      kind: "polygon";
      points: readonly Point[];
      /** Đỉnh nhọn: scene chấm tròn viền mực ở đây cho góc bo như nét `round` của SVG. */
      corners: readonly Point[];
    };

/** Dời đa giác để tâm khung bao về (0, 0). */
function centered(points: readonly Point[]): Point[] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(([x, y]) => [x - cx, y - cy] as const);
}

const polygon = (points: readonly Point[]): ShapeGeometry => {
  const pts = centered(points);
  return { kind: "polygon", points: pts, corners: pts };
};

const deg = (d: number) => (d * Math.PI) / 180;

/** Tam giác đều đỉnh hướng lên, cạnh 2,1. */
function triangle(): ShapeGeometry {
  const half = 1.05;
  const h = half * Math.sqrt(3);
  return polygon([
    [0, -h / 2],
    [half, h / 2],
    [-half, h / 2],
  ]);
}

/** Sao 5 cánh, cánh trên cùng hướng lên. */
function star(): ShapeGeometry {
  const pts = Array.from({ length: 10 }, (_, i): Point => {
    const a = deg(-90 + i * 36);
    const r = i % 2 === 0 ? 1.08 : 0.46;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return polygon(pts);
}

/** Dấu cộng nét dày (nửa bề dày 0,34, nửa chiều dài 0,94). */
function cross(): ShapeGeometry {
  const t = 0.34;
  const e = 0.94;
  return polygon([
    [-t, -e],
    [t, -e],
    [t, -t],
    [e, -t],
    [e, t],
    [t, t],
    [t, e],
    [-t, e],
    [-t, t],
    [-e, t],
    [-e, -t],
    [-t, -t],
  ]);
}

/**
 * Trăng lưỡi liềm: đĩa bán kính 1 bị khoét bởi đĩa bán kính 0,82 lệch 0,52 về phía trên phải
 * (lưỡi liềm mở về trên phải, chỗ dày nhất ~0,7). Hai mũi nhọn là hai giao điểm của hai vòng.
 */
function crescent(): ShapeGeometry {
  const big = 1;
  const small = 0.82;
  const dist = 0.52;
  const dir = deg(-35);
  const alpha = Math.acos((big * big + dist * dist - small * small) / (2 * big * dist));
  const beta = Math.acos((small * small + dist * dist - big * big) / (2 * small * dist));
  const sx = Math.cos(dir) * dist;
  const sy = Math.sin(dir) * dist;
  const outer = 36;
  const inner = 24;
  const pts: Point[] = [];
  // Cung ngoài: đi vòng xa phía đĩa khoét, từ mũi trên tới mũi dưới.
  for (let i = 0; i <= outer; i++) {
    const a = dir + alpha + ((2 * Math.PI - 2 * alpha) * i) / outer;
    pts.push([Math.cos(a) * big, Math.sin(a) * big]);
  }
  // Cung trong (mép đĩa khoét nằm trong đĩa lớn): quay ngược về mũi đầu.
  for (let i = 1; i < inner; i++) {
    const a = dir + Math.PI + beta - (2 * beta * i) / inner;
    pts.push([sx + Math.cos(a) * small, sy + Math.sin(a) * small]);
  }
  const all = centered(pts);
  const tips = [all[0], all[outer]].filter((p): p is Point => p !== undefined);
  return { kind: "polygon", points: all, corners: tips };
}

/** Hình theo mã 0 … 5. */
export const SHAPES: readonly ShapeGeometry[] = [
  { kind: "circle", r: 0.92 },
  triangle(),
  polygon([
    [-0.77, -0.77],
    [0.77, -0.77],
    [0.77, 0.77],
    [-0.77, 0.77],
  ]),
  star(),
  cross(),
  crescent(),
];

/**
 * Màu phụ của từng hình: màu thương hiệu (giữ nguyên ở cả nền sáng lẫn tối, đủ tương phản trên
 * bảng phấn xanh và tím than), luôn kèm viền mực nên vẫn rõ trên thẻ giấy. `fallback` là giá trị
 * của token trong globals.css, chỉ dùng khi không đọc được biến CSS. `className` cho SVG.
 */
export const SHAPE_PAINTS = [
  { token: "--color-pink", fallback: "#f7a8b8", className: "fill-pink" },
  { token: "--color-sun", fallback: "#ffd166", className: "fill-sun" },
  { token: "--color-sky", fallback: "#8ec5ff", className: "fill-sky" },
  { token: "--color-identify", fallback: "#f2a541", className: "fill-identify" },
  { token: "--color-mint", fallback: "#7fd1ae", className: "fill-mint" },
  { token: "--color-grape", fallback: "#c3a6ff", className: "fill-grape" },
] as const;

/** Thuộc tính `points` của SVG cho đa giác, nhân bán kính `r`. */
export function svgPoints(points: readonly Point[], r: number): string {
  return points.map(([x, y]) => `${(x * r).toFixed(2)},${(y * r).toFixed(2)}`).join(" ");
}
