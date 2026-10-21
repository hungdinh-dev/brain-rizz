import { cn } from "@/lib/utils";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import {
  CHALK_CAP_PATH,
  CHALK_PATH,
  CHALK_SIZE,
  cupBandPath,
  cupBodyPath,
  cupRimPath,
  ERASER_FELT,
  ERASER_GRAIN,
  ERASER_GRAIN_PATH,
  ERASER_PATH,
  ERASER_SIZE,
  ERASER_WOOD,
  rotateIconPaths,
} from "./shapes";

/** Nét phấn sần: filter SVG #chalk khai báo một lần trong <ChalkDefs /> của App. */
const CHALK = "filter-[url(#chalk)]";

/** Ba khung 160 × 260, cách nhau 24 (chỗ mũi tên); tâm khung. */
const PANELS = [16, 200, 384];
const PANEL = { y: 20, w: 160, h: 260 } as const;
const centerOf = (x: number) => x + PANEL.w / 2;

/** Cốc thu nhỏ, cùng hình với scene; ba cốc mỗi khung cách nhau 48, đáy ở y 228. */
const CUP_W = 44;
const CUP_H = 54;
const CUP_PITCH = 48;
const BASE_Y = 228;
const LIFT = 32;
const CUP_BODY = cupBodyPath(CUP_W, CUP_H);
const CUP_BAND = cupBandPath(CUP_W, CUP_H);
const CUP_RIM = cupRimPath(CUP_W, CUP_H);

/** Tẩy chia hai nửa (gỗ trên, nỉ dưới), bo góc như ERASER_PATH. */
const ERASER_R = 7;
const EH = ERASER_SIZE.h;
const EW = ERASER_SIZE.w / 2;
const ERASER_TOP = `M${-EW} ${-EH / 2} L${-EW} ${-EH + ERASER_R} Q${-EW} ${-EH} ${-EW + ERASER_R} ${-EH} L${EW - ERASER_R} ${-EH} Q${EW} ${-EH} ${EW} ${-EH + ERASER_R} L${EW} ${-EH / 2}Z`;
const ERASER_BOTTOM = `M${-EW} ${-EH / 2} L${EW} ${-EH / 2} L${EW} ${-ERASER_R} Q${EW} 0 ${EW - ERASER_R} 0 L${-EW + ERASER_R} 0 Q${-EW} 0 ${-EW} ${-ERASER_R}Z`;

const ROTATE = rotateIconPaths(11, 4);
const TICK = "M-6 0 L-1.5 4.5 L6.5 -4.5";

/** Cốc úp (đáy ở y), nhấc lên `lift`. Thân nền bảng để che vật phía sau, viền phấn, dải cam. */
function Cup({ x, lift = 0 }: { x: number; lift?: number }) {
  return (
    <g transform={`translate(${x} ${BASE_Y - lift})`} strokeLinejoin="round">
      <path d={CUP_BODY} className="fill-board" />
      <path d={CUP_BAND} className="fill-identify" />
      <path d={CUP_BODY} className={cn(CHALK, "fill-none stroke-chalk")} strokeWidth={3} />
      <path d={CUP_RIM} className={cn(CHALK, "fill-board stroke-chalk")} strokeWidth={3} />
    </g>
  );
}

/** Cục phấn trắng nằm trên bàn, đáy ở (x, y). */
function Chalk({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={CHALK_PATH} className="fill-chalk" />
      <path
        d={CHALK_CAP_PATH}
        className="fill-none stroke-ink"
        strokeOpacity={0.45}
        strokeWidth={3}
      />
    </g>
  );
}

/** Cục tẩy: nửa trên gỗ có vân, nửa dưới nỉ xám, viền phấn. */
function Eraser({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={ERASER_TOP} fill={ERASER_WOOD} />
      <path d={ERASER_GRAIN_PATH} fill="none" stroke={ERASER_GRAIN} strokeWidth={3} />
      <path d={ERASER_BOTTOM} fill={ERASER_FELT} />
      <path d={ERASER_PATH} className="fill-none stroke-chalk" strokeWidth={4} />
    </g>
  );
}

/** Hàng ba cốc trên vạch bàn của một khung; `lifted` = ô cốc nhấc lên. */
function Row({ cx, lifted }: { cx: number; lifted?: number }) {
  return (
    <>
      <path
        d={`M${cx - 72} ${BASE_Y + 5} L${cx + 72} ${BASE_Y + 5}`}
        className={cn(CHALK, "stroke-chalk/60")}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {[-1, 0, 1].map((k) => (
        <Cup key={k} x={cx + k * CUP_PITCH} lift={lifted === k ? LIFT : 0} />
      ))}
    </>
  );
}

function Panel({ x }: { x: number }) {
  return (
    <>
      <rect
        x={x}
        y={PANEL.y}
        width={PANEL.w}
        height={PANEL.h}
        rx={16}
        fill="#000000"
        fillOpacity={0.16}
      />
      <rect
        x={x}
        y={PANEL.y}
        width={PANEL.w}
        height={PANEL.h}
        rx={16}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
    </>
  );
}

/** Mũi tên phấn nối hai khung. */
function Next({ x }: { x: number }) {
  return (
    <path
      d={`M${x} 150 L${x + 16} 150 M${x + 10} 144 L${x + 16} 150 L${x + 10} 156`}
      className={cn(CHALK, "fill-none stroke-chalk")}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * Hình minh hoạ Tráo cốc (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: ba khung
 * nối bằng mũi tên phấn. Trái (mắt): cốc giữa nhấc lên, thấy cục phấn. Giữa: cốc giữa và cốc phải
 * đổi chỗ, cung trên và cung dưới ngược chiều; cốc úp phấn có chấm phấn mờ ở chân. Phải (ngón
 * tay): chạm cốc phải, cốc nhấc lên lộ phấn + dấu tích. Góc dưới phải: huy hiệu xoay vòng (Khó)
 * và huy hiệu phấn + tẩy (Siêu khó). Đặt trên nền bảng (`bg-board`).
 */
export function CupShuffleHowTo({ className }: { className?: string }) {
  const [left, middle, right] = PANELS.map(centerOf) as [number, number, number];
  const chalkScale = 38 / CHALK_SIZE.w;
  return (
    <svg viewBox="8 6 544 350" aria-hidden className={cn("overflow-visible", className)}>
      {PANELS.map((x) => (
        <Panel key={x} x={x} />
      ))}
      <Next x={180} />
      <Next x={364} />

      {/* Trái: mắt, cốc giữa nhấc lên thấy phấn */}
      <g
        transform={`translate(${left} 74) scale(0.8)`}
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinejoin="round"
      >
        <path d={EYE_PATH} strokeWidth={6} />
        <circle r={13} strokeWidth={5} />
      </g>
      <circle cx={left} cy={74} r={5} className="fill-identify" />
      <Chalk x={left} y={BASE_Y} scale={chalkScale} />
      <Row cx={left} lifted={0} />

      {/* Giữa: cốc giữa (úp phấn) ↔ cốc phải, cung trên sang phải, cung dưới sang trái */}
      <Row cx={middle} />
      <circle cx={middle} cy={BASE_Y + 11} r={3.5} className="fill-chalk" fillOpacity={0.55} />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M285 166 C293 136 317 136 325 162 M315.4 154.5 L325 162 L328.8 150.4" />
        <path d="M325 244 C317 274 293 274 285 248 M294.6 255.5 L285 248 L281.3 259.6" />
      </g>

      {/* Phải: ngón tay chạm cốc phải, cốc nhấc lên lộ phấn, dấu tích */}
      <Chalk x={right + CUP_PITCH} y={BASE_Y} scale={chalkScale} />
      <Row cx={right} lifted={1} />
      <path
        d={HAND_PATH}
        transform={`translate(${right + CUP_PITCH} 134) rotate(180) scale(-2.3 2.3) translate(-11 -3.5)`}
        className="fill-board stroke-chalk"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <g transform="translate(534 158)">
        <circle r={11} strokeWidth={2.5} className="fill-primary stroke-ink" />
        <path
          d={TICK}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </g>

      {/* Góc dưới phải: huy hiệu xoay vòng (Khó) và phấn + tẩy (Siêu khó) */}
      <g transform="translate(424 318)">
        <circle r={20} strokeWidth={3} className={cn(CHALK, "fill-board-shade stroke-chalk")} />
        <path d={ROTATE.arcs} fill="none" strokeWidth={3} className="stroke-identify" />
        <path d={ROTATE.heads} className="fill-identify" />
      </g>
      <rect
        x={456}
        y={300}
        width={88}
        height={36}
        rx={18}
        strokeWidth={3}
        className={cn(CHALK, "fill-board-shade stroke-chalk")}
      />
      <Chalk x={478} y={322} scale={30 / CHALK_SIZE.w} />
      <path
        d="M500 318 L508 318 M504 314 L504 322"
        className="stroke-chalk"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Eraser x={525} y={327} scale={0.4} />
    </svg>
  );
}
