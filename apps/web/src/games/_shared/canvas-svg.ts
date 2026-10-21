import { Fragment, isValidElement, type ReactNode } from "react";

/*
 * Vẽ một cây phần tử SVG (React) lên canvas 2D, để scene Phaser dùng lại đúng hình nhân vật của
 * components/characters/specs.tsx và buddies.tsx mà không cần asset ngoài hay tải ảnh bất đồng bộ.
 * Chỉ hỗ trợ tập con mà hai file đó dùng: <g>, <path d>, <circle>, <ellipse>, <rect> (có rx), thuộc
 * tính fill / stroke / strokeWidth / strokeLinecap / strokeLinejoin / opacity / fillOpacity /
 * strokeOpacity, transform translate / rotate / scale, Fragment và mảng. Thuộc tính khác (className
 * cho hoạt ảnh CSS…) bỏ qua; component tự viết không vẽ.
 */

type Ctx = CanvasRenderingContext2D;

interface SvgProps {
  children?: ReactNode;
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: CanvasLineCap;
  strokeLinejoin?: CanvasLineJoin;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  transform?: string;
}

/** Thuộc tính tô được kế thừa từ <g> cha (như SVG). */
interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  fillOpacity: number;
  strokeOpacity: number;
}

/** Mặc định của SVG: tô đen, không viền. */
const ROOT: Paint = {
  fill: "#000000",
  stroke: "none",
  strokeWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  fillOpacity: 1,
  strokeOpacity: 1,
};

const TRANSFORM = /(translate|rotate|scale)\(([^)]*)\)/g;

function applyTransform(ctx: Ctx, transform: string) {
  for (const [, name, args = ""] of transform.matchAll(TRANSFORM)) {
    const n = args
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (name === "translate") ctx.translate(n[0] ?? 0, n[1] ?? 0);
    else if (name === "scale") ctx.scale(n[0] ?? 1, n[1] ?? n[0] ?? 1);
    else {
      const [angle = 0, cx = 0, cy = 0] = n;
      ctx.translate(cx, cy);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
  }
}

function toPath(type: string, p: SvgProps): Path2D | null {
  if (type === "path") return p.d ? new Path2D(p.d) : null;
  const path = new Path2D();
  switch (type) {
    case "circle":
      path.arc(p.cx ?? 0, p.cy ?? 0, p.r ?? 0, 0, Math.PI * 2);
      return path;
    case "ellipse":
      path.ellipse(p.cx ?? 0, p.cy ?? 0, p.rx ?? 0, p.ry ?? 0, 0, 0, Math.PI * 2);
      return path;
    case "rect": {
      const [x, y, w, h] = [p.x ?? 0, p.y ?? 0, p.width ?? 0, p.height ?? 0];
      const r = Math.min(p.rx ?? p.ry ?? 0, w / 2, h / 2);
      if (r <= 0) {
        path.rect(x, y, w, h);
        return path;
      }
      path.moveTo(x + r, y);
      path.arcTo(x + w, y, x + w, y + h, r);
      path.arcTo(x + w, y + h, x, y + h, r);
      path.arcTo(x, y + h, x, y, r);
      path.arcTo(x, y, x + w, y, r);
      path.closePath();
      return path;
    }
    default:
      return null;
  }
}

function paintPath(ctx: Ctx, path: Path2D, paint: Paint) {
  const alpha = ctx.globalAlpha;
  if (paint.fill !== "none") {
    ctx.globalAlpha = alpha * paint.fillOpacity;
    ctx.fillStyle = paint.fill;
    ctx.fill(path);
  }
  if (paint.stroke !== "none" && paint.strokeWidth > 0) {
    ctx.globalAlpha = alpha * paint.strokeOpacity;
    ctx.strokeStyle = paint.stroke;
    ctx.lineWidth = paint.strokeWidth;
    ctx.lineCap = paint.lineCap;
    ctx.lineJoin = paint.lineJoin;
    ctx.stroke(path);
  }
  ctx.globalAlpha = alpha;
}

/** Vẽ `node` lên `ctx` theo toạ độ hiện tại của ctx (gọi translate/scale trước để đặt hình). */
export function drawSvg(ctx: Ctx, node: ReactNode, paint: Paint = ROOT): void {
  if (Array.isArray(node)) {
    for (const child of node) drawSvg(ctx, child, paint);
    return;
  }
  if (!isValidElement(node)) return;
  const props = node.props as SvgProps;
  if (node.type === Fragment) {
    drawSvg(ctx, props.children, paint);
    return;
  }
  if (typeof node.type !== "string") return;

  const own: Paint = {
    fill: props.fill ?? paint.fill,
    stroke: props.stroke ?? paint.stroke,
    strokeWidth: props.strokeWidth ?? paint.strokeWidth,
    lineCap: props.strokeLinecap ?? paint.lineCap,
    lineJoin: props.strokeLinejoin ?? paint.lineJoin,
    fillOpacity: props.fillOpacity ?? paint.fillOpacity,
    strokeOpacity: props.strokeOpacity ?? paint.strokeOpacity,
  };
  ctx.save();
  if (props.opacity !== undefined) ctx.globalAlpha *= props.opacity;
  if (props.transform) applyTransform(ctx, props.transform);
  if (node.type === "g") drawSvg(ctx, props.children, own);
  else {
    const path = toPath(node.type, props);
    if (path) paintPath(ctx, path, own);
  }
  ctx.restore();
}
