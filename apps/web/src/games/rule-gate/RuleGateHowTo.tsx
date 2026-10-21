import type { RuleGateSpecies } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import {
  ARROW_LEFT,
  BODY,
  BUDDY_ANCHOR,
  FEET,
  HAT,
  INK,
  PAWS,
  SPECIES,
  STICKER_HALO,
  TICK,
} from "./shapes";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Đường viền vé (tâm (0, 0)): chữ nhật bo góc, khuyết nửa tròn giữa hai cạnh bên, như trong scene. */
function ticketD(w: number, h: number, r = 12, notch = 9): string {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  return [
    `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${-notch}`,
    `A${notch} ${notch} 0 0 0 ${x1} ${notch} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${notch}`,
    `A${notch} ${notch} 0 0 0 ${x0} ${-notch} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`,
  ].join(" ");
}

/** Mũ lưỡi trai trên người bạn (cùng hình với scene). */
function Hat() {
  return (
    <g stroke={INK} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
      <path d={HAT.brim} fill={HAT.fill} />
      <path d={HAT.brim} fill="#000000" fillOpacity={0.22} stroke="none" />
      <path d={HAT.crown} fill={HAT.fill} />
      <path d={HAT.seam} strokeWidth={3} strokeOpacity={0.45} fill="none" />
      <circle cx={HAT.button.cx} cy={HAT.button.cy} r={HAT.button.r} fill={INK} stroke="none" />
    </g>
  );
}

/** Một bạn nhãn dán (viền trắng), tay không; neo giữa thân tại (x, y). */
function Buddy({
  species,
  hat,
  x,
  y,
  scale,
}: {
  species: RuleGateSpecies;
  hat: boolean;
  x: number;
  y: number;
  scale: number;
}) {
  const look = SPECIES[species];
  const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale}) translate(${-BUDDY_ANCHOR.x} ${-BUDDY_ANCHOR.y})`}
    >
      <g fill="none" stroke={STICKER_HALO} strokeWidth={16} strokeLinejoin="round">
        <path d={look.ears} />
        <path d={FEET} />
        <path d={BODY} />
        {look.tail && <path d={look.tail} />}
      </g>
      {look.tail && <path d={look.tail} fill={look.fill} strokeWidth={5} {...line} />}
      <path d={look.ears} fill={look.earFill} strokeWidth={5} {...line} />
      {look.earInner && <path d={look.earInner} fill={look.earInnerFill} />}
      <path d={FEET} fill={look.limb} strokeWidth={5} {...line} />
      <path d={BODY} fill={look.fill} />
      {look.patch && <path d={look.patch} fill={look.patchFill} />}
      <path d={BODY} fill="none" strokeWidth={6} {...line} />
      {look.whiskers && (
        <path d={look.whiskers} fill="none" strokeWidth={2.5} strokeOpacity={0.55} {...line} />
      )}
      {look.blushX.map((bx) => (
        <ellipse
          key={bx}
          cx={bx}
          cy={look.blushY}
          rx={9}
          ry={5}
          fill={look.blush}
          fillOpacity={0.85}
        />
      ))}
      {look.eyeX.map((ex) =>
        look.eyes === "panda" ? (
          <g key={ex}>
            <circle cx={ex} cy={look.eyeY} r={5} fill="#ffffff" />
            <circle cx={ex + 1} cy={look.eyeY + 0.5} r={3} fill={INK} />
          </g>
        ) : (
          <g key={ex}>
            <ellipse cx={ex} cy={look.eyeY} rx={6} ry={7.5} fill={INK} />
            <circle cx={ex - 2} cy={look.eyeY - 3} r={2.2} fill="#ffffff" />
          </g>
        ),
      )}
      <path d={look.nose} fill={look.noseFill} strokeWidth={2.5} {...line} />
      <path d={look.mouth} fill="none" strokeWidth={3.5} {...line} />
      {PAWS.none.map(([px, py]) => (
        <ellipse
          key={px}
          cx={px}
          cy={py}
          rx={12}
          ry={9}
          fill={look.limb}
          strokeWidth={4}
          {...line}
        />
      ))}
      {hat && <Hat />}
    </g>
  );
}

/** Mũi tên phấn (đường + đầu mũi tên). */
function ChalkArrow({ d, head }: { d: string; head: string }) {
  return (
    <g className={cn(CHALK, "chalk-stroke stroke-chalk")} strokeWidth={5}>
      <path d={d} />
      <path d={head} />
    </g>
  );
}

/**
 * Hình minh hoạ Cổng luật (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: khung
 * bảng phấn; trên cùng tấm vé vẽ mũ lưỡi trai (mũi tên nhỏ chỉ về cổng). Giữa: bạn thỏ đội mũ đứng
 * trước cổng; cổng lớp bên trái mở, mũi tên phấn cong vào cổng + dấu ✓; ngôi nhà bên phải mờ, gạch
 * chéo. Góc dưới: bạn mèo không mũ nhỏ hơn, mũi tên chỉ về nhà (ví dụ không khớp). Đặt trên nền bảng.
 */
export function RuleGateHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 360" aria-hidden className={cn("overflow-visible", className)}>
      {/* Khung bảng phấn */}
      <rect x={6} y={6} width={548} height={348} rx={18} fill="#000000" fillOpacity={0.16} />
      <rect
        x={6}
        y={6}
        width={548}
        height={348}
        rx={18}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />

      {/* Vé: mũ lưỡi trai; mũi tên nhỏ chỉ về phía cổng */}
      <g transform="translate(300 64)">
        <path
          d={ticketD(150, 84)}
          strokeWidth={4}
          className={cn(CHALK, "stroke-chalk fill-chalk")}
          fillOpacity={0.08}
        />
        <g transform="scale(0.5) translate(-122 -38)" className={cn(CHALK, "stroke-chalk")}>
          <path
            d={HAT.brim}
            strokeWidth={10}
            strokeLinejoin="round"
            className="fill-chalk"
            fillOpacity={0.5}
          />
          <path
            d={HAT.crown}
            strokeWidth={10}
            strokeLinejoin="round"
            className="fill-chalk"
            fillOpacity={0.14}
          />
          <circle cx={HAT.button.cx} cy={HAT.button.cy} r={6} className="fill-chalk" />
        </g>
      </g>
      <g
        transform="translate(196 64) scale(0.7)"
        className={cn(CHALK, "chalk-stroke stroke-chalk")}
      >
        <path d={ARROW_LEFT} strokeWidth={8} />
      </g>

      {/* Mặt đất */}
      <path
        d="M26 318 L534 318"
        strokeWidth={3}
        strokeOpacity={0.35}
        className="chalk-stroke stroke-chalk"
      />

      {/* Cổng lớp (mở) */}
      <g strokeLinejoin="round" className={cn(CHALK, "stroke-chalk")} strokeWidth={3.5}>
        <rect
          x={56}
          y={146}
          width={72}
          height={172}
          fill="#000000"
          fillOpacity={0.18}
          stroke="none"
        />
        <path d="M56 150 L72 157 L72 312 L56 318 Z" className="fill-wood" />
        <path d="M128 150 L112 157 L112 312 L128 318 Z" className="fill-wood" />
        <rect x={40} y={140} width={16} height={178} rx={4} className="fill-wood" />
        <rect x={128} y={140} width={16} height={178} rx={4} className="fill-wood" />
        <rect x={32} y={124} width={120} height={20} rx={6} className="fill-wood" />
        <rect x={74} y={100} width={36} height={30} rx={4} className="fill-card" />
        <path d="M82 110 L104 110 M82 118 L104 118" strokeWidth={2.5} className="stroke-analyze" />
      </g>

      {/* Bạn thỏ đội mũ: khớp vé → vào cổng */}
      <Buddy species="bunny" hat x={290} y={236} scale={0.62} />
      <ChalkArrow d="M226 214 C200 176 176 172 156 188" head="M172 186 L156 188 L162 173" />
      <g transform="translate(152 104)">
        <circle cy={3} r={16} className="fill-ink" />
        <circle r={16} strokeWidth={3} className="fill-primary stroke-ink" />
        <path
          d={TICK}
          transform="scale(0.62)"
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </g>

      {/* Nhà (mờ, gạch chéo): bạn thỏ không về nhà */}
      <g
        opacity={0.45}
        strokeLinejoin="round"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      >
        <rect x={426} y={210} width={96} height={108} rx={4} className="fill-card" />
        <path d="M414 214 L474 150 L534 214 Z" className="fill-wood" />
        <path d="M462 318 V282 C462 270 486 270 486 282 V318 Z" className="fill-wood" />
        <rect x={436} y={226} width={18} height={18} rx={3} fill="none" />
      </g>
      <path
        d="M440 170 L510 290 M510 170 L440 290"
        strokeWidth={12}
        strokeLinecap="round"
        stroke="#ffffff"
        strokeOpacity={0.85}
      />
      <path
        d="M440 170 L510 290 M510 170 L440 290"
        strokeWidth={6.5}
        strokeLinecap="round"
        className="stroke-destructive"
      />

      {/* Ví dụ không khớp: bạn mèo không mũ → về nhà */}
      <Buddy species="cat" hat={false} x={372} y={312} scale={0.3} />
      <ChalkArrow d="M404 326 C424 326 440 318 452 304" head="M438 306 L452 304 L450 318" />
    </svg>
  );
}
