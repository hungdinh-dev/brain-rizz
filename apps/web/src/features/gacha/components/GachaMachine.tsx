import { cn } from "@/lib/utils";

/*
 * Máy quay phụ kiện (bản mẫu canvas "Phấn & phụ kiện", khu 30): SVG khung 240 × 290. Màu là màu
 * hình vẽ cố định như nhân vật / phụ kiện (không đổi theo sáng/tối), lấy đúng bản mẫu.
 */
const INK = "#1f1b3a";
const PAPER = "#fff8ef";
const SUN = "#ffd166";
const ROSE = "#f27d93";
const GRAPE = "#7768ae";
const SLOT = "#2a2540";

/** Viên nang trong lồng kính: vị trí, góc, màu nửa trên (nửa dưới giấy). */
const PILE: readonly (readonly [number, number, number, string])[] = [
  [74, 116, 8, "#8ec5ff"],
  [102, 126, -12, SUN],
  [134, 124, 20, "#7fd1ae"],
  [162, 114, -24, "#f7a8b8"],
  [66, 90, 30, "#c3a6ff"],
  [96, 98, -6, "#f2a541"],
  [128, 96, 14, "#8ec5ff"],
  [158, 86, -30, SUN],
  [110, 70, 24, "#f7a8b8"],
  [140, 62, -10, "#7fd1ae"],
  [84, 64, 4, SUN],
];

function Capsule({ r, color }: { r: number; color: string }) {
  return (
    <>
      <path
        d={`M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z`}
        fill={color}
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path
        d={`M${-r} 0 A${r} ${r} 0 0 0 ${r} 0 Z`}
        fill={PAPER}
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path
        d={`M${-r * 0.6} ${-r * 0.55} C${-r * 0.4} ${-r * 0.75} ${-r * 0.15} ${-r * 0.8} ${r * 0.05} ${-r * 0.8}`}
        stroke="#ffffff"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        opacity={0.85}
      />
    </>
  );
}

interface GachaMachineProps {
  /** Bề rộng px (cao = 290/240 × rộng). Bản mẫu: điện thoại 224, thiếu phấn 124, máy tính 330. */
  width: number;
  /** Đang quay: tay quay xoay, đống viên nang lắc, viên nang rơi ra (đặt lại `key` để chạy lại). */
  spinning?: boolean;
  /** Chưa kết nối máy chủ dữ liệu: mờ 35 %. */
  dim?: boolean;
  label: string;
  className?: string;
}

/** Máy quay viên nang: lồng kính chứa viên nang, thân hồng, tay quay vàng, cửa ra viên nang. */
export function GachaMachine({
  width,
  spinning = false,
  dim = false,
  label,
  className,
}: GachaMachineProps) {
  const height = Math.round((width * 290) / 240);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 240 290"
      role="img"
      aria-label={label}
      className={cn("shrink-0 overflow-visible", dim && "opacity-35", className)}
    >
      <ellipse cx="120" cy="281" rx="96" ry="8" fill="rgba(0,0,0,.25)" />
      <rect
        x="50"
        y="262"
        width="36"
        height="18"
        rx="6"
        fill={GRAPE}
        stroke={INK}
        strokeWidth="5"
      />
      <rect
        x="154"
        y="262"
        width="36"
        height="18"
        rx="6"
        fill={GRAPE}
        stroke={INK}
        strokeWidth="5"
      />
      <path
        d="M40 150 L200 150 L208 260 C208 267 204 270 197 270 L43 270 C36 270 32 267 32 260 Z"
        fill={ROSE}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M37 196 L203 196 L204 206 L36 206 Z"
        fill={SUN}
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Huy hiệu viên phấn trên thân */}
      <circle cx="74" cy="173" r="15" fill={PAPER} stroke={INK} strokeWidth="4" />
      <g transform="translate(74 173) rotate(-35)">
        <rect
          x="-10"
          y="-4"
          width="20"
          height="8"
          rx="4"
          fill={PAPER}
          stroke={INK}
          strokeWidth="2.4"
        />
        <path d="M3 -4 H6 A4 4 0 0 1 6 4 H3 Z" fill={SUN} stroke={INK} strokeWidth="2.4" />
      </g>
      {/* Cửa ra viên nang */}
      <rect
        x="50"
        y="216"
        width="60"
        height="42"
        rx="13"
        fill={SLOT}
        stroke={INK}
        strokeWidth="5"
      />
      <g
        key={spinning ? "drop-on" : "drop-off"}
        className={cn("gacha-part", spinning && "fx-gacha-drop")}
      >
        <g transform="translate(80 246) rotate(18)">
          <Capsule r={11} color="#c3a6ff" />
        </g>
      </g>
      <path
        d="M56 222 L104 222"
        stroke={PAPER}
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".35"
      />
      {/* Tay quay */}
      <g className={cn("gacha-part", spinning && "fx-gacha-crank")}>
        <circle cx="160" cy="232" r="26" fill={SUN} stroke={INK} strokeWidth="5" />
        <rect
          x="134"
          y="226"
          width="52"
          height="12"
          rx="6"
          fill={PAPER}
          stroke={INK}
          strokeWidth="4"
        />
        <circle cx="160" cy="232" r="5" fill={INK} />
      </g>
      {/* Lồng kính */}
      <circle cx="120" cy="86" r="76" fill="rgba(255,255,255,.2)" />
      <g className={cn("gacha-part", spinning && "fx-gacha-shake")}>
        {PILE.map(([x, y, rot, color]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <Capsule r={16} color={color} />
          </g>
        ))}
      </g>
      <circle cx="120" cy="86" r="76" fill="none" stroke={INK} strokeWidth="5" />
      <path
        d="M66 54 C76 36 94 24 114 19"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity=".75"
      />
      <path
        d="M58 78 C58 72 60 66 62 62"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity=".6"
      />
      <rect
        x="44"
        y="140"
        width="152"
        height="18"
        rx="9"
        fill={GRAPE}
        stroke={INK}
        strokeWidth="5"
      />
      <rect x="102" y="2" width="36" height="16" rx="8" fill={SUN} stroke={INK} strokeWidth="4.5" />
    </svg>
  );
}

interface CapsuleIconProps {
  size: number;
  /** Đang tới lượt mở: lắc ±6°. */
  wobble?: boolean;
  className?: string;
}

/**
 * Viên nang chưa mở (màn mở quà): nửa trên giấy, nửa dưới hồng, dấu "?". Mọi viên giống hệt nhau —
 * không lộ độ hiếm trước khi mở.
 */
export function CapsuleIcon({ size, wobble = false, className }: CapsuleIconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0 overflow-visible", wobble && "fx-gacha-wobble", className)}
    >
      <path
        d="M16 52 A34 34 0 0 1 84 52 Z"
        fill={PAPER}
        fillOpacity={0.9}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M16 52 A34 34 0 0 0 84 52 Z"
        fill={ROSE}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M30 34 C36 26 44 23 52 23"
        stroke="#ffffff"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        className="font-display"
        fontWeight="800"
        fontSize="26"
        fill={INK}
      >
        ?
      </text>
    </svg>
  );
}
