import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Ô phép 88 × 48: bóng đổ mực, mặt giấy, nhãn phép (như ô phép trong scene). */
function Cell({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-44} y={-20} width={88} height={48} rx={12} className="fill-ink" />
      <rect
        x={-44}
        y={-24}
        width={88}
        height={48}
        rx={12}
        strokeWidth={3}
        className="fill-paper stroke-ink"
      />
      <text
        y={10}
        textAnchor="middle"
        fontSize={28}
        className="fill-ink font-display font-extrabold"
      >
        {label}
      </text>
    </g>
  );
}

/** Cửa ra: đĩa mực (tối: viền phấn), bên trong là hình riêng của đường. */
function Exit({ x, children }: { x: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} 280)`}>
      <circle cy={4} r={26} className="fill-ink" />
      <circle r={26} strokeWidth={2} className="fill-ink stroke-ink dark:stroke-chalk" />
      {children}
    </g>
  );
}

/** Số trung gian viết phấn nhỏ cạnh đường. */
function ChalkNumber({ x, y, value }: { x: number; y: number; value: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fontSize={26}
      className={cn(CHALK, "fill-chalk font-display font-extrabold")}
    >
      {value}
    </text>
  );
}

/**
 * Hình minh hoạ Đường số (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: góc trên
 * phải là thẻ đích 13 (kèm hồng tâm nhỏ); giữa phía trên là vòng xuất phát 5. Hai đường phấn đi
 * xuống: đường trái (nét liền vàng, cửa ○) qua "×2" rồi "+3", cạnh đường có số trung gian "10",
 * "13"; đường phải (nét gạch hồng, cửa △) qua "+4" rồi "×2", mờ đi, dưới cửa ghi "18" bị gạch.
 * Ngón tay đang chạm cửa ○, cạnh cửa có dấu ✓. Đặt trên nền bảng.
 */
export function NumberPathHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Đường phải (sai): nét gạch hồng, ô và cửa △, mờ đi */}
      <g opacity={0.45}>
        <path
          d="M280 52 L364 128 L364 280"
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="16 11"
          className={cn(CHALK, "stroke-pink")}
        />
        <Cell x={364} y={128} label="+4" />
        <Cell x={364} y={206} label="×2" />
        <Exit x={364}>
          <path
            d="M0 -13 L14 10 L-14 10 Z"
            fill="none"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeDasharray="8 5"
            className="stroke-pink"
          />
        </Exit>
      </g>
      {/* Kết quả đường phải: 18, bị gạch */}
      <text
        x={364}
        y={343}
        textAnchor="middle"
        fontSize={28}
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
      >
        18
      </text>
      <path
        d="M342 342 L386 318"
        strokeWidth={4.5}
        strokeLinecap="round"
        className="stroke-destructive"
      />

      {/* Đường trái (đúng): nét liền vàng, ô, số trung gian, cửa ○ */}
      <path
        d="M280 52 L196 128 L196 280"
        fill="none"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(CHALK, "stroke-sun")}
      />
      <Cell x={196} y={128} label="×2" />
      <Cell x={196} y={206} label="+3" />
      <ChalkNumber x={178} y={176} value="10" />
      <ChalkNumber x={178} y={251} value="13" />
      <Exit x={196}>
        <circle r={12} fill="none" strokeWidth={4.5} className="stroke-sun" />
      </Exit>

      {/* Vòng xuất phát 5 */}
      <circle cx={280} cy={56} r={30} className="fill-ink" />
      <circle cx={280} cy={52} r={30} strokeWidth={3} className="fill-paper stroke-ink" />
      <text
        x={280}
        y={64}
        textAnchor="middle"
        fontSize={34}
        className="fill-ink font-display font-extrabold"
      >
        5
      </text>

      {/* Thẻ đích 13: nền mực chữ vàng, hồng tâm nhỏ bên trái */}
      <rect x={404} y={28} width={128} height={58} rx={14} className="fill-ink" />
      <rect
        x={404}
        y={24}
        width={128}
        height={58}
        rx={14}
        strokeWidth={2}
        className="fill-ink stroke-ink dark:stroke-chalk"
      />
      <circle cx={432} cy={53} r={15} strokeWidth={2.5} className="fill-compute stroke-ink" />
      <circle cx={432} cy={53} r={8} className="fill-paper" />
      <circle cx={432} cy={53} r={3} className="fill-ink" />
      <text
        x={486}
        y={67}
        textAnchor="middle"
        fontSize={38}
        className="fill-primary font-display font-extrabold"
      >
        13
      </text>

      {/* Dấu ✓ cạnh cửa ○ */}
      <g transform="translate(150 262)">
        <circle cy={3} r={15} className="fill-ink" />
        <circle r={15} strokeWidth={3} className="fill-primary stroke-ink" />
        <path
          d="M-7 1 L-2 6 L8 -5"
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </g>

      {/* Ngón tay đang chạm cửa ○ */}
      <path
        transform="translate(210 292) scale(2.2) translate(-11 -3.5)"
        d="M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
