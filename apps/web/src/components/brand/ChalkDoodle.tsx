import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hình vẽ phấn trang trí trên bảng (nét sần nhờ filter #chalk trong <ChalkDefs />).
 * Chỉ để trang trí: luôn aria-hidden. Màu là màu thương hiệu, giống nhau ở sáng/tối.
 */

const SHAPES = {
  star: (
    <path
      d="M50 8 L61 36 L91 38 L68 57 L76 87 L50 70 L24 87 L32 57 L9 38 L39 36 Z"
      fillOpacity={0.22}
      fill="currentColor"
    />
  ),
  sparkle: (
    <path
      d="M50 10 C54 40 60 46 90 50 C60 54 54 60 50 90 C46 60 40 54 10 50 C40 46 46 40 50 10 Z"
      fill="currentColor"
    />
  ),
  question: (
    <>
      <rect x={12} y={12} width={76} height={76} rx={12} fill="currentColor" fillOpacity={0.18} />
      <path d="M38 38 C38 24 63 24 63 40 C63 51 50 51 50 61" />
      <circle cx={50} cy={74} r={3} />
    </>
  ),
  puzzle: (
    <path
      d="M20 30 L40 30 C38 16 62 16 60 30 L80 30 L80 50 C94 48 94 72 80 70 L80 88 L20 88 L20 68 C34 70 34 46 20 48 Z"
      fill="currentColor"
      fillOpacity={0.2}
    />
  ),
  magnifier: (
    <>
      <circle cx={42} cy={42} r={24} fill="currentColor" fillOpacity={0.18} />
      <path d="M60 60 L84 84" strokeWidth={7} />
      <path d="M32 36 C34 30 38 28 44 28" />
    </>
  ),
  math: (
    <>
      <path d="M18 30 L42 30 M30 18 L30 42 M60 20 L82 42 M82 20 L60 42 M18 72 L42 72 M60 72 L82 72" />
      <circle cx={71} cy={62} r={2.5} fill="currentColor" />
      <circle cx={71} cy={82} r={2.5} fill="currentColor" />
    </>
  ),
  bulb: (
    <>
      <path
        d="M50 14 C30 14 20 30 24 46 C27 58 38 60 38 72 L62 72 C62 60 73 58 76 46 C80 30 70 14 50 14 Z"
        fill="currentColor"
        fillOpacity={0.2}
      />
      <path d="M40 80 L60 80 M43 88 L57 88 M44 50 L50 58 L56 50" />
    </>
  ),
  triangle: <path d="M50 12 L90 84 L10 84 Z" fill="currentColor" fillOpacity={0.2} />,
  clock: (
    <>
      <circle cx={50} cy={50} r={38} fill="currentColor" fillOpacity={0.16} />
      <path d="M50 26 L50 50 L66 60 M50 16 L50 20 M84 50 L80 50 M50 84 L50 80 M16 50 L20 50" />
    </>
  ),
  dice: (
    <>
      <rect x={16} y={16} width={68} height={68} rx={14} fill="currentColor" fillOpacity={0.18} />
      <circle cx={34} cy={34} r={4} fill="currentColor" />
      <circle cx={50} cy={50} r={4} fill="currentColor" />
      <circle cx={66} cy={66} r={4} fill="currentColor" />
    </>
  ),
  cube: (
    <path
      d="M50 18 L80 34 L80 66 L50 82 L20 66 L20 34 Z M20 34 L50 50 L80 34 M50 50 L50 82"
      fill="currentColor"
      fillOpacity={0.18}
    />
  ),
  pencil: <path d="M20 80 L28 60 L70 18 L82 30 L40 72 Z M62 26 L74 38 M20 80 L40 72" />,
  plane: (
    <path d="M10 50 L90 14 L66 88 L48 60 Z M48 60 L90 14" fill="currentColor" fillOpacity={0.15} />
  ),
  three: (
    <text
      x={50}
      y={80}
      fontFamily="var(--font-display)"
      fontWeight={800}
      fontSize={88}
      textAnchor="middle"
      strokeWidth={3.5}
    >
      3
    </text>
  ),
} satisfies Record<string, ReactNode>;

export type DoodleShape = keyof typeof SHAPES;

export function ChalkDoodle({ shape, className }: { shape: DoodleShape; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cn("chalk-stroke overflow-visible", className)}
      stroke="currentColor"
    >
      {SHAPES[shape]}
    </svg>
  );
}

/** Khai báo filter SVG #chalk một lần cho cả app (đặt trong khung app). */
export function ChalkDefs() {
  return (
    <svg width={0} height={0} className="absolute" aria-hidden>
      <defs>
        <filter id="chalk" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={1}
            seed={4}
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={2.6}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
