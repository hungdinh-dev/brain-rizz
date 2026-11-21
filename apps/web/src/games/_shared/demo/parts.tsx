import type { ReactNode } from "react";
import { TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { HAND_PATH } from "../icons";

/*
 * Mảnh dùng chung của khung diễn (UI-UX 6.11, canvas khu 29 "Khung diễn · đặc tả"). Mọi mảnh vẽ
 * quanh gốc 0,0; vị trí đặt bằng thuộc tính `transform` của nhóm ngoài, chuyển động bằng CSS của
 * nhóm trong (`dk dk-<làn>`), nên hai thứ không đè nhau. Nét trơn, không filter (lớp động).
 */

/** Vật động: `<g translate(x y)>` (thuộc tính) bọc `<g class="dk dk-<k>">` mang keyframe. */
export function A({
  k,
  x = 0,
  y = 0,
  className,
  children,
}: {
  /** Tên làn trong kịch bản. */
  k: string;
  x?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}) {
  const inner = <g className={cn("dk", `dk-${k}`, className)}>{children}</g>;
  return x || y ? <g transform={`translate(${x} ${y})`}>{inner}</g> : inner;
}

/** Bọc một câu: chuyển câu thu/phóng quanh tâm sân khấu (320, 180), nội dung vẽ toạ độ tuyệt đối. */
export function Question({ k, children }: { k: string; children: ReactNode }) {
  return (
    <A k={k} x={320} y={180}>
      <g transform="translate(-320 -180)">{children}</g>
    </A>
  );
}

/** Mũi tên chuột 23 × 34, đỉnh ở gốc. */
const ARROW_PATH = "M0 0 L0 30 L8 23 L13 34 L18 32 L13 21 L23 21 Z";
/** Bàn tay × 3 (43 × 51), gốc = đầu ngón trỏ. */
const HAND_TRANSFORM = "scale(3) translate(-11 -3.5)";

/**
 * Con trỏ: bàn tay (màn cảm ứng) hoặc mũi tên chuột, có bóng. Làn `hand` (vị trí), `hs` (bóng),
 * `hp` / `hpm` (nhấn tay / chuột). Vẽ cả hai, ẩn bằng `visibility` để đổi thiết bị giữa chừng không
 * làm keyframe chạy lại lệch đồng hồ.
 */
export function Cursor() {
  const touch = useMediaQuery(TOUCH_QUERY);
  const handVis = touch ? "visible" : "hidden";
  const arrowVis = touch ? "hidden" : "visible";
  return (
    <A k="hand">
      <A k="hs">
        <g transform="translate(5 7)" className="fill-black" opacity={0.28}>
          <path d={HAND_PATH} transform={HAND_TRANSFORM} visibility={handVis} />
          <path d={ARROW_PATH} visibility={arrowVis} />
        </g>
      </A>
      <A k="hp">
        <path
          d={HAND_PATH}
          transform={HAND_TRANSFORM}
          visibility={handVis}
          className="fill-paper stroke-ink"
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </A>
      <A k="hpm">
        <path
          d={ARROW_PATH}
          visibility={arrowVis}
          className="fill-paper stroke-ink"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </A>
    </A>
  );
}

/** Sóng chạm: vòng phấn r 26 nét 4 + chấm r 9 (45 %). */
export function Ripple({ k, x, y }: { k: string; x: number; y: number }) {
  return (
    <A k={k} x={x} y={y}>
      <circle r={26} fill="none" className="stroke-chalk" strokeWidth={4} />
      <circle r={9} className="fill-chalk" opacity={0.45} />
    </A>
  );
}

const OK_PATH = "M-8 0.5 L-2.5 6 L8 -6";
const X_PATH = "M-6.5 -6.5 L6.5 6.5 M6.5 -6.5 L-6.5 6.5";
const BOLT_PATH = "M2 -10 L-7 2 L-1 2 L-3 10 L7 -2 L1 -2 Z";

/** Dấu ✓ (đúng), ✗ (sai), ⚡ (nhanh): tròn r 17 viền mực 3, bóng 3. */
export function Mark({
  k,
  x,
  y,
  kind,
}: {
  k: string;
  x: number;
  y: number;
  kind: "ok" | "bad" | "fast";
}) {
  return (
    <A k={k} x={x} y={y}>
      <circle cy={3} r={17} className="fill-ink" />
      <circle
        r={17}
        className={cn(
          "stroke-ink",
          kind === "ok" && "fill-compute",
          kind === "bad" && "fill-destructive",
          kind === "fast" && "fill-primary",
        )}
        strokeWidth={3}
      />
      {kind === "ok" && (
        <path
          d={OK_PATH}
          fill="none"
          className="stroke-ink"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {kind === "bad" && (
        <path
          d={X_PATH}
          fill="none"
          className="stroke-destructive-foreground"
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
      {kind === "fast" && (
        <path
          d={BOLT_PATH}
          className="fill-ink stroke-ink"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}
    </A>
  );
}

/** Vòng khoanh: nét vàng 5 trên nét mực 9 (thấy được trên cả thẻ giấy và bảng). */
export function Ring({
  k,
  x,
  y,
  rx,
  ry = rx,
}: {
  k: string;
  x: number;
  y: number;
  rx: number;
  ry?: number;
}) {
  return (
    <A k={k} x={x} y={y}>
      <ellipse rx={rx} ry={ry} fill="none" className="stroke-ink" strokeWidth={9} />
      <ellipse rx={rx} ry={ry} fill="none" className="stroke-primary" strokeWidth={5} />
    </A>
  );
}

/** Vòng khoanh chữ nhật bo góc `w × h` (góc `rx`) quanh tâm: như `Ring`, để khoanh thẻ. */
export function RectRing({
  k,
  x,
  y,
  w,
  h,
  rx,
}: {
  k: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}) {
  const rect = { x: -w / 2, y: -h / 2, width: w, height: h, rx, fill: "none" } as const;
  return (
    <A k={k} x={x} y={y}>
      <rect {...rect} className="stroke-ink" strokeWidth={9} />
      <rect {...rect} className="stroke-primary" strokeWidth={5} />
    </A>
  );
}

/**
 * Huy hiệu icon tròn r `r` nền bảng viền phấn 2,5, bóng 3 (icon xoay, gương, mặt đối diện…). Icon
 * vẽ quanh tâm, trong nhóm nét phấn không tô, đầu/góc nét tròn (con tự đặt `strokeWidth`).
 */
export function IconBadge({
  k,
  x,
  y,
  r,
  children,
}: {
  k: string;
  x: number;
  y: number;
  r: number;
  children: ReactNode;
}) {
  return (
    <A k={k} x={x} y={y}>
      <circle cy={3} r={r} className="fill-ink" />
      <circle r={r} className="fill-board stroke-chalk" strokeWidth={2.5} />
      <g fill="none" className="stroke-chalk" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </A>
  );
}

/** Huy hiệu số nhỏ (r 14, nền giấy hoặc màu), bóng 2: thứ tự chạm, thứ tự đúng. */
export function NumberBadge({
  k,
  x,
  y,
  n,
  tone = "paper",
}: {
  k: string;
  x: number;
  y: number;
  n: number;
  tone?: "paper" | "memorize";
}) {
  return (
    <A k={k} x={x} y={y}>
      <circle cy={2} r={14} className="fill-ink" />
      <circle
        r={14}
        className={cn("stroke-ink", tone === "paper" ? "fill-paper" : "fill-memorize")}
        strokeWidth={2.5}
      />
      <text
        y={6.5}
        textAnchor="middle"
        fontSize={18}
        className="fill-ink font-display font-extrabold"
      >
        {n}
      </text>
    </A>
  );
}

/**
 * Huy hiệu bước tại (40, 40): tròn r 21 nền bảng viền phấn 3, số Baloo 24; ba số mờ chéo theo
 * làn `s1`–`s3`, khớp số của danh sách 3 bước dưới khung.
 */
export function StepBadge() {
  return (
    <g transform="translate(40 40)">
      <circle r={21} className="fill-board stroke-chalk" strokeWidth={3} />
      {[1, 2, 3].map((n) => (
        <A key={n} k={`s${n}`}>
          <text
            y={8.5}
            textAnchor="middle"
            fontSize={24}
            className="fill-chalk font-display font-extrabold"
          >
            {n}
          </text>
        </A>
      ))}
    </g>
  );
}

/** Nhãn khoá: viên thuốc hồng 80 × 32 viền mực + ổ khoá + thanh rút ngắn (làn `kb`, scaleX 1 → 0). */
export function LockPill({ k, kb, x, y }: { k: string; kb: string; x: number; y: number }) {
  return (
    <A k={k} x={x} y={y}>
      <rect x={-40} y={-13} width={80} height={32} rx={16} className="fill-ink" />
      <rect
        x={-40}
        y={-16}
        width={80}
        height={32}
        rx={16}
        className="fill-pink stroke-ink"
        strokeWidth={3}
      />
      <rect x={-29} y={-5} width={14} height={11} rx={2.5} className="fill-ink" />
      <path
        d="M-26 -5 L-26 -8 C-26 -12.5 -18 -12.5 -18 -8 L-18 -5"
        fill="none"
        className="stroke-ink"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <rect x={-8} y={-4} width={40} height={8} rx={4} className="fill-ink" opacity={0.22} />
      <A k={kb} x={-8}>
        <rect y={-4} width={40} height={8} rx={4} className="fill-ink" />
      </A>
    </A>
  );
}
