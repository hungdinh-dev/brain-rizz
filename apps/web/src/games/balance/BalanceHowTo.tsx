import type { BalanceItem } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import { ITEM_ART, partKey } from "../_shared/items";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Một vật vẽ từ bảng hình chung với scene (items.ts), viền mực. Dùng lại ở BalanceDemo. */
export function Item({
  item,
  x,
  y,
  size,
}: {
  item: BalanceItem;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size})`}
      className="text-ink"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ITEM_ART[item].map((part) => {
        const key = partKey(part);
        if (part.kind === "path") {
          return (
            <path
              key={key}
              d={part.d}
              fill={part.fill ?? "none"}
              stroke={part.outline ? "currentColor" : "none"}
              strokeWidth={part.outline}
              opacity={part.opacity}
            />
          );
        }
        if (part.kind === "circle") {
          return (
            <circle
              key={key}
              cx={part.cx}
              cy={part.cy}
              r={part.r}
              fill={part.fill}
              stroke={part.outline ? "currentColor" : "none"}
              strokeWidth={part.outline}
            />
          );
        }
        return (
          <ellipse
            key={key}
            cx={part.cx}
            cy={part.cy}
            rx={part.rx}
            ry={part.ry}
            fill={part.fill}
            opacity={part.opacity}
            transform={part.rotate ? `rotate(${part.rotate} ${part.cx} ${part.cy})` : undefined}
          />
        );
      })}
    </g>
  );
}

/** Đĩa cân treo ở (x, y): hai dây + lòng đĩa. `small` cho cân nhỏ ở góc. */
function Pan({ x, y, small }: { x: number; y: number; small?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={cn(CHALK, "stroke-chalk")}>
      {small ? (
        <>
          <path d="M0 0 L-18 30 M0 0 L18 30" fill="none" strokeWidth={2} />
          <path
            d="M-22 30 L22 30 C19 37 11 39 0 39 C-11 39 -19 37 -22 30 Z"
            className="fill-board-shade"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path d="M0 0 L-26 44 M0 0 L26 44" fill="none" strokeWidth={2.2} />
          <path
            d="M-30 44 L30 44 C26 52 15 55 0 55 C-15 55 -26 52 -30 44 Z"
            className="fill-board-shade"
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </>
      )}
    </g>
  );
}

/** Cân to trong khung dọc: trụ tại (280, top), `dip` > 0 là đĩa trái thấp (bên nặng). */
function TiltedScale({
  top,
  dip,
  left,
  right,
}: {
  top: number;
  dip: number;
  left: BalanceItem;
  right: BalanceItem;
}) {
  const leftEnd = { x: 202.38, y: top + dip };
  const rightEnd = { x: 357.62, y: top - dip };
  return (
    <g>
      <g className={cn(CHALK, "stroke-chalk")} strokeLinecap="round" fill="none">
        <path d={`M280 ${top} L280 ${top + 74}`} strokeWidth={4} />
        <path d={`M${leftEnd.x} ${leftEnd.y} L${rightEnd.x} ${rightEnd.y}`} strokeWidth={5} />
      </g>
      <path
        d={`M246 ${top + 80} L252 ${top + 70} L308 ${top + 70} L314 ${top + 80} Z`}
        className={cn(CHALK, "fill-analyze stroke-chalk")}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <circle cx={280} cy={top} r={5} className="fill-chalk" />
      <Pan {...leftEnd} />
      <Pan {...rightEnd} />
      <Item item={left} x={leftEnd.x} y={leftEnd.y + 24} size={0.42} />
      <Item item={right} x={rightEnd.x} y={rightEnd.y + 24} size={0.42} />
    </g>
  );
}

/** Số phấn ①②③ khớp ba bước của màn Hướng dẫn. */
const STEP_MARKS = [
  { x: 159, y: 129 },
  { x: 76, y: 146 },
  { x: 331, y: 256 },
];

const CHOICES: BalanceItem[] = ["banana", "watermelon", "apple"];

/**
 * Hình minh hoạ Cân não (màn Hướng dẫn, thẻ game), theo bản mẫu BalanceHowTo: khung dọc như màn
 * chơi mức Mầm. Cân trên táo thấp hơn chuối (①), cân dưới dưa hấu thấp hơn táo; hàng dưới
 * chuối · dưa hấu · táo, ô dưa hấu được khoanh phấn và có bàn tay chỉ vào (③). Góc trái: cân nhỏ
 * thăng bằng nấm = cà rốt (②). Đặt trên nền bảng (`bg-board`).
 */
export function BalanceHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="2 6 418 348" aria-hidden className={cn("overflow-visible", className)}>
      <rect
        x={146}
        y={12}
        width={268}
        height={336}
        rx={18}
        className={cn(CHALK, "fill-board-shade stroke-chalk/85")}
        strokeWidth={3}
      />

      <TiltedScale top={60} dip={19.35} left="apple" right="banana" />
      <TiltedScale top={166} dip={-19.35} left="apple" right="watermelon" />

      <path
        d="M166 254 C230 251 330 257 394 253"
        fill="none"
        className={cn(CHALK, "stroke-chalk/70")}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {CHOICES.map((item, i) => {
        const x = 208 + i * 72;
        return (
          <g key={item}>
            <rect x={x - 27} y={269} width={54} height={54} rx={10} className="fill-ink" />
            <rect
              x={x - 27}
              y={266}
              width={54}
              height={54}
              rx={10}
              className="fill-paper stroke-ink"
              strokeWidth={3}
            />
            <Item item={item} x={x} y={293} size={0.4} />
          </g>
        );
      })}
      <ellipse
        cx={280}
        cy={293}
        rx={40}
        ry={36}
        fill="none"
        className={cn(CHALK, "stroke-primary")}
        strokeWidth={4}
      />
      <path
        transform="translate(300 312) scale(2) translate(-11 -3.5)"
        d="M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Cân nhỏ thăng bằng ở góc: nấm = cà rốt, dấu "=" trên trụ */}
      <g className={cn(CHALK, "stroke-chalk")} strokeLinecap="round" fill="none">
        <path d="M76 54 L76 112" strokeWidth={3.5} />
        <path d="M30 54 L122 54" strokeWidth={4} />
      </g>
      <path
        d="M56 120 L62 112 L90 112 L96 120 Z"
        className={cn(CHALK, "fill-analyze stroke-chalk")}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <circle cx={76} cy={54} r={4} className="fill-chalk" />
      <Pan x={30} y={54} small />
      <Pan x={122} y={54} small />
      <Item item="mushroom" x={30} y={68} size={0.34} />
      <Item item="carrot" x={122} y={68} size={0.34} />
      <circle
        cx={76}
        cy={88}
        r={11}
        className={cn(CHALK, "fill-analyze stroke-chalk")}
        strokeWidth={2.2}
      />
      <path
        d="M71 85 L81 85 M71 91 L81 91"
        fill="none"
        className="stroke-ink"
        strokeWidth={2.8}
        strokeLinecap="round"
      />

      <g className={CHALK}>
        {STEP_MARKS.map(({ x, y }, i) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={12} className="fill-board stroke-chalk" strokeWidth={2.5} />
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              className="fill-chalk font-display text-[17px] font-extrabold"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
