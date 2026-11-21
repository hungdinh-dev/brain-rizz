import { STACK_RECALL_KINDS, type StackRecallKind } from "@brain-rizz/shared";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import {
  blockRadius,
  KIND_FILL_CLASSES,
  patternMarks,
  SHAPE_HEIGHT_RATIO,
  SHAPE_PATHS,
} from "./blocks";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Khối tháp thu nhỏ trong hình: 96 × 36, khe 4; khối khay 30 × 30. */
const BLOCK_W = 96;
const BLOCK_H = 36;
const PITCH = 40;
/** Mép trên bệ (chung cho ba phần). */
const BASE_TOP = 246;
/** Tâm tầng `i` (0 = đáy). */
const layerY = (i: number) => BASE_TOP - PITCH * i - BLOCK_H / 2;

/** Tháp mẫu từ dưới lên: tim sọc chéo, vuông sọc ngang, tam giác chấm bi (đặc tả). */
const TOWER: StackRecallKind[] = [4, 1, 2];
/** Khay 5 khối của mức Thường: tròn, vuông, tam giác, sao, tim. */
const TRAY: StackRecallKind[] = [0, 1, 2, 3, 4];
const TRAY_SIZE = 30;
const TRAY_PITCH = 35;
const TRAY_LEFT = 362;
const TRAY_Y = 290;
const trayX = (i: number) => TRAY_LEFT + TRAY_PITCH * i + TRAY_SIZE / 2;

/** Một khối vẽ từ cùng bảng hình với scene (blocks.ts): màu gợi ý, hoa văn phấn, hình giữa khối. */
export function Block({
  kind,
  x,
  y,
  w,
  h,
}: {
  kind: StackRecallKind;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const clip = useId();
  const art = STACK_RECALL_KINDS[kind] ?? STACK_RECALL_KINDS[0];
  const marks = patternMarks(art.pattern, w, h);
  const r = blockRadius(h);
  const scale = (h * SHAPE_HEIGHT_RATIO) / 100;
  return (
    <g transform={`translate(${x} ${y})`}>
      <clipPath id={clip}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} />
      </clipPath>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} className={KIND_FILL_CLASSES[kind]} />
      <g clipPath={`url(#${clip})`} opacity={0.72}>
        {marks.lines ? (
          <path
            d={marks.lines}
            fill="none"
            strokeWidth={marks.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-chalk"
          />
        ) : null}
        {marks.fills ? <path d={marks.fills} className="fill-chalk" /> : null}
      </g>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={r}
        fill="none"
        strokeWidth={2}
        className="stroke-ink"
      />
      <path
        d={SHAPE_PATHS[art.shape]}
        transform={`scale(${scale})`}
        strokeWidth={1.8 / scale}
        strokeLinejoin="round"
        className="fill-paper stroke-ink"
      />
    </g>
  );
}

/** Bệ gỗ dưới tháp, tâm x. */
function Base({ x }: { x: number }) {
  return (
    <rect
      x={x - 56}
      y={BASE_TOP}
      width={112}
      height={8}
      rx={4}
      className={cn(CHALK, "fill-wood stroke-chalk")}
      strokeWidth={2.5}
    />
  );
}

/** Mũi tên phấn nối hai phần (cong nhẹ, chỉ sang phải). */
function Link({ from, to }: { from: number; to: number }) {
  const mid = (from + to) / 2;
  return (
    <g
      className={cn(CHALK, "fill-none stroke-chalk")}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${from} 48 C${mid - 20} 38 ${mid + 20} 38 ${to} 48`} />
      <path d={`M${to - 11} 40 L${to} 48 L${to - 12} 54`} />
    </g>
  );
}

/**
 * Hình minh hoạ Xếp lại tháp (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả:
 * Trái (mắt): tháp 3 tầng trên bệ (từ dưới lên tim, vuông, tam giác), mũi tên phấn đi từ dưới lên
 * ghi 1, 2, 3. Giữa (mắt nhắm): khăn lau đang quét ngang che tháp. Phải (ngón tay): 3 ô tầng nét
 * đứt, ô đáy đã có khối tim; khay 5 khối, ngón tay chạm khối vuông, mũi tên nét đứt bay lên ô tầng
 * thứ 2. Cạnh khay: huy hiệu xáo khay nhỏ (luật Siêu khó). Đặt trên nền bảng; chữ số là ký hiệu.
 */
export function StackRecallHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Trái: mắt, tháp, thứ tự từ dưới lên */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={EYE_PATH} transform="translate(96 44) scale(0.737)" strokeWidth={5.4} />
        <circle cx={96} cy={44} r={9} strokeWidth={3.5} />
      </g>
      <circle cx={96} cy={44} r={4} className="fill-chalk" />
      <Base x={96} />
      {TOWER.map((kind, i) => (
        <Block key={kind} kind={kind} x={96} y={layerY(i)} w={BLOCK_W} h={BLOCK_H} />
      ))}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M158 242 L158 136" />
        <path d="M151 145 L158 134 L165 145" />
      </g>
      {TOWER.map((kind, i) => (
        <text
          key={kind}
          x={176}
          y={layerY(i) + 8}
          textAnchor="middle"
          fontSize={22}
          className={cn(CHALK, "fill-chalk font-display font-extrabold")}
        >
          {i + 1}
        </text>
      ))}

      <Link from={136} to={222} />

      {/* Giữa: mắt nhắm, khăn lau quét ngang che tháp */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M242 40 C252 54 260 58 268 58 C276 58 284 54 294 40" strokeWidth={4} />
        <path d="M252 51 L247 61 M268 58 L268 69 M284 51 L289 61" strokeWidth={3.5} />
      </g>
      <Base x={268} />
      {TOWER.map((kind, i) => (
        <Block key={kind} kind={kind} x={268} y={layerY(i)} w={BLOCK_W} h={BLOCK_H} />
      ))}
      <rect
        x={206}
        y={118}
        width={92}
        height={132}
        rx={12}
        className={cn(CHALK, "fill-memorize stroke-chalk")}
        strokeWidth={2.5}
      />
      <path
        d="M214 248 L262 120 M246 248 L290 130"
        className="fill-none stroke-pink"
        strokeWidth={9}
        strokeOpacity={0.55}
        strokeLinecap="round"
      />
      <rect
        x={213}
        y={125}
        width={78}
        height={118}
        rx={8}
        className="fill-none stroke-chalk"
        strokeOpacity={0.75}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      {/* Khăn lau đi từ trái sang phải */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M226 272 L308 272" />
        <path d="M299 265 L309 272 L299 279" />
      </g>

      <Link from={314} to={414} />

      {/* Phải: ngón tay, ô tầng nét đứt, khay */}
      <path
        d={HAND_PATH}
        transform="translate(452 44) scale(2.2) translate(-12.3 -12)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={1.9}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Base x={452} />
      {[1, 2].map((i) => (
        <rect
          key={i}
          x={452 - BLOCK_W / 2}
          y={layerY(i) - BLOCK_H / 2}
          width={BLOCK_W}
          height={BLOCK_H}
          rx={blockRadius(BLOCK_H)}
          className={cn(CHALK, "fill-board-shade stroke-chalk")}
          strokeOpacity={0.8}
          strokeWidth={2.5}
          strokeDasharray="6 5"
        />
      ))}
      <Block kind={4} x={452} y={layerY(0)} w={BLOCK_W} h={BLOCK_H} />
      {TRAY.map((kind, i) => (
        <Block key={kind} kind={kind} x={trayX(i)} y={TRAY_Y} w={TRAY_SIZE} h={TRAY_SIZE} />
      ))}
      <rect
        x={trayX(1) - 20}
        y={TRAY_Y - 20}
        width={40}
        height={40}
        rx={9}
        className={cn(CHALK, "fill-none stroke-primary")}
        strokeWidth={3.5}
      />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M388 268 C374 248 376 212 396 192" strokeDasharray="6 5" />
        <path d="M385.4 194.6 L397 191 L394.6 202.6" />
      </g>
      <path
        d={HAND_PATH}
        transform={`translate(${trayX(1) + 3} 300) scale(1.5) translate(-11 -3.5)`}
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Cạnh khay: huy hiệu xáo khay (luật Siêu khó) */}
      <circle
        cx={342}
        cy={TRAY_Y}
        r={13}
        className={cn(CHALK, "fill-memorize stroke-chalk")}
        strokeWidth={2.5}
      />
      <path
        d={`M335 ${TRAY_Y - 4} L346 ${TRAY_Y - 4} M349 ${TRAY_Y + 4} L338 ${TRAY_Y + 4}`}
        className="fill-none stroke-ink"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d={`M344 ${TRAY_Y - 8} L350 ${TRAY_Y - 4} L344 ${TRAY_Y} Z M340 ${TRAY_Y} L334 ${TRAY_Y + 4} L340 ${TRAY_Y + 8} Z`}
        className="fill-ink"
      />
    </svg>
  );
}
