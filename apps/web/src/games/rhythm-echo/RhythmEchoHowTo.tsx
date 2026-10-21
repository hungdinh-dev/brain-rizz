import { cn } from "@/lib/utils";
import { HAND_PATH } from "../_shared/icons";
import {
  DRUM_DOT,
  DRUM_RIM,
  DRUM_RING_INNER,
  DRUM_RING_OUTER,
  EAR_PATH,
  lacePath,
  MUTE_PATH,
  NOTE_STEM_PATH,
  SPEAKER_PATH,
} from "./shapes";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

type Side = "left" | "right";

/** Hoa văn mặt trống: trái = vòng đồng tâm + chấm giữa, phải = dây chéo chữ X ở viền (như scene). */
function Pattern({ r, side, className }: { r: number; side: Side; className: string }) {
  return (
    <g className={className} fill="none">
      <circle r={r * DRUM_RIM} />
      <circle r={r * DRUM_RING_OUTER} />
      {side === "left" ? (
        <>
          <circle r={r * DRUM_RING_INNER} />
          <circle r={r * DRUM_DOT} className="fill-current" stroke="none" />
        </>
      ) : (
        <path d={lacePath(r * DRUM_RIM, r * DRUM_RING_OUTER)} />
      )}
    </g>
  );
}

/**
 * Một trống. Sáng: nền vàng to 106 %, viền mực + viền phấn bên trong, hoa văn mực, hai vòng sóng
 * lan ra (`wave`). Tắt: mặt bảng tối, viền và hoa văn phấn.
 */
function Drum({
  x,
  y,
  r,
  side,
  lit = false,
  wave = false,
}: {
  x: number;
  y: number;
  r: number;
  side: Side;
  lit?: boolean;
  wave?: boolean;
}) {
  if (!lit) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={r} strokeWidth={3} className={cn(CHALK, "fill-board-shade stroke-chalk")} />
        <Pattern
          r={r}
          side={side}
          className={cn(CHALK, "stroke-chalk text-chalk opacity-55 [stroke-width:2.2]")}
        />
      </g>
    );
  }
  const big = r * 1.06;
  return (
    <g transform={`translate(${x} ${y})`}>
      {wave && (
        <g className={cn(CHALK, "fill-none stroke-primary")} strokeWidth={4}>
          <circle r={big + 12} strokeOpacity={0.7} />
          <circle r={big + 24} strokeOpacity={0.35} />
        </g>
      )}
      <circle r={big} strokeWidth={4} className="fill-primary stroke-ink" />
      <circle r={big - 6} strokeWidth={3.5} className={cn(CHALK, "fill-none stroke-chalk")} />
      <Pattern
        r={big - 4}
        side={side}
        className="stroke-ink text-ink opacity-85 [stroke-width:2.4]"
      />
    </g>
  );
}

/** Nốt nhạc phấn (móc đơn), đầu nốt tại (x, y). */
function Note({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className={cn(CHALK, "stroke-chalk")}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse rx={7.5} ry={5.5} transform="rotate(-20)" className="fill-chalk" stroke="none" />
      <path d={NOTE_STEM_PATH} fill="none" strokeWidth={3.5} />
    </g>
  );
}

/**
 * Hình minh hoạ Nhại nhịp (màn Hướng dẫn, thẻ game): một khung tĩnh chia hai nửa, giữa là mũi tên
 * phấn. Nửa trái "Nghe" (tai): trống trái đang sáng, có vòng sóng và nốt nhạc bay lên; dưới là dải
 * nhịp 4 chấm cách đều không đều, chấm thứ 2 đang sáng. Nửa phải "Gõ lại" (ngón tay): ngón tay chạm
 * trống phải, trống đó sáng; dải tiến độ 2 chấm đặc, 2 rỗng. Góc dưới phải: loa gạch chéo cạnh
 * trống sáng — tắt tiếng vẫn chơi được. Đặt trên nền bảng (`bg-board`).
 */
export function RhythmEchoHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="12 10 536 344" aria-hidden className={cn("overflow-visible", className)}>
      {/* Nửa trái: tai, hai trống (trái đang sáng), nốt nhạc, dải nhịp */}
      <path
        d={EAR_PATH}
        transform="translate(115 18) scale(2.1)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Drum x={86} y={160} r={42} side="left" lit wave />
      <Drum x={196} y={160} r={42} side="right" />
      <Note x={40} y={110} />
      <Note x={128} y={92} scale={0.75} />
      {/* Vạch thời gian: hình chữ nhật mảnh thay cho đường kẻ ngang — filter phấn cắt mất đường
          có khung bao cao 0. */}
      <rect x={44} y={260.5} width={192} height={3} rx={1.5} className="fill-chalk opacity-60" />
      {[56, 104, 132, 224].map((cx, i) =>
        i === 1 ? (
          <circle
            key={cx}
            cx={cx}
            cy={262}
            r={10}
            strokeWidth={3}
            className="fill-primary stroke-ink"
          />
        ) : (
          <circle key={cx} cx={cx} cy={262} r={7} className={cn(CHALK, "fill-chalk")} />
        ),
      )}

      {/* Mũi tên phấn ở giữa */}
      <path
        d="M254 160 C270 152 290 152 306 160 M295 148 L307 160 L295 172"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nửa phải: ngón tay, hai trống (phải đang sáng, được chạm), chấm tiến độ */}
      <path
        d={HAND_PATH}
        transform="translate(424 42) scale(1.7) translate(-12.3 -12)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Drum x={364} y={160} r={42} side="left" />
      <Drum x={474} y={160} r={42} side="right" lit wave />
      <path
        d={HAND_PATH}
        transform="translate(486 168) scale(2.4) translate(-11 -3.5)"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[384, 408].map((cx) => (
        <circle key={cx} cx={cx} cy={262} r={8} className={cn(CHALK, "fill-chalk")} />
      ))}
      {[432, 456].map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy={262}
          r={7}
          strokeWidth={3}
          className={cn(CHALK, "fill-none stroke-chalk")}
        />
      ))}

      {/* Góc dưới phải: tắt tiếng vẫn chơi được */}
      <g
        transform="translate(436 304) scale(1.25)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={SPEAKER_PATH} />
        <path d={MUTE_PATH} />
      </g>
      <Drum x={508} y={319} r={17} side="right" lit />
    </svg>
  );
}
