import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Cần gạt hình mũi tên (chỉ xuống khi chưa xoay), cùng hình với scene. */
const ARROW = "M-6 0 L-6 44 L-14 44 L0 70 L14 44 L6 44 L6 0 Z";
/** Vòng mũi tên trên chốt công tắc. */
const FLIP_ICON =
  "M-10.3 -3.8 A11 11 0 0 1 10.3 -3.8 M3.6 -7.7 L10.3 -3.8 L13 -11.1 M10.3 3.8 A11 11 0 0 1 -10.3 3.8 M-3.6 7.7 L-10.3 3.8 L-13 11.1";
const CUP = "M-44 0 L44 0 L35 92 C34 100 29 104 21 104 L-21 104 C-29 104 -34 100 -35 92 Z";
const HAND =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";
/** Ống của khung dọc (Mầm: 2 tầng, 3 cốc) và hai chạc ở cột trái. */
const PIPES =
  "M285 50 L285 88 M248 176.8 L285 88 L322 176.8 M211 265.6 L248 176.8 L285 265.6 M285 265.6 L322 176.8 L359 265.6 M211 265.6 L211 276 M285 265.6 L285 276 M359 265.6 L359 276 M80 28 L80 74 M54.4 135.4 L80 74 L105.6 135.4 M80 200 L80 246 M54.4 307.4 L80 246 L105.6 307.4";
/** Góc nghiêng cần gạt: dương = chỉ trái, âm = chỉ phải. */
const TILT = 22.6;

function Lever({ x, y, size, tilt }: { x: number; y: number; size: number; tilt: number }) {
  return (
    <path
      d={ARROW}
      transform={`translate(${x} ${y}) scale(${size}) rotate(${tilt})`}
      className={cn(CHALK, "fill-analyze stroke-chalk")}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

function Ball({ x, y, gold }: { x: number; y: number; gold?: boolean }) {
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={11}
        className={cn(gold ? "fill-primary" : "fill-paper", "stroke-ink")}
        strokeWidth={3}
      />
      <ellipse
        cx={x - 5}
        cy={y - 5}
        rx={3}
        ry={2}
        fill="#ffffff"
        opacity={0.8}
        transform={`rotate(-35 ${x - 5} ${y - 5})`}
      />
    </>
  );
}

/** Số phấn ①②③ khớp ba bước của màn Hướng dẫn: cần gạt, cốc, công tắc. */
const STEP_MARKS = [
  { x: 322, y: 70 },
  { x: 327, y: 276 },
  { x: 30, y: 74 },
];

const CUPS = [
  { x: 211, letter: "A" },
  { x: 285, letter: "B" },
  { x: 359, letter: "C" },
];

/**
 * Hình minh hoạ Bi rơi đâu (màn Hướng dẫn, thẻ game), theo bản mẫu MarbleDropHowTo: khung dọc
 * như màn chơi mức Mầm. Bi vàng ở phễu, cần gạt tầng 1 chỉ phải (①), tầng 2 hai cần gạt chỉ trái;
 * nét đứt vàng theo mũi tên xuống cốc B được khoanh phấn, có bàn tay chạm (②). Cột trái (③): công
 * tắc vàng; bi 1 qua thì rẽ trái và công tắc lật, bi 2 (vàng, dấu ?) qua thì rẽ phải, bóng nét đứt
 * chỉ vị trí cũ. Đặt trên nền bảng (`bg-board`).
 */
export function MarbleDropHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      <rect
        x={160}
        y={12}
        width={250}
        height={336}
        rx={18}
        className={cn(CHALK, "fill-board-shade stroke-chalk/85")}
        strokeWidth={3}
      />

      {/* Ống: viền phấn, lòng màu bảng */}
      <g className={CHALK} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={PIPES} className="stroke-chalk" strokeWidth={14} />
        <path d={PIPES} className="stroke-board" strokeWidth={8} />
      </g>
      <path
        d="M258.1 24 L311.9 24 L293.4 55.1 L276.6 55.1 Z"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Đường bi: nét đứt vàng (bi được hỏi), nét đứt phấn (bi 1 ở cột trái) */}
      <g className={CHALK} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g className="stroke-primary" strokeWidth={4}>
          <path d="M285 40 L285 88 L322 176.8 L285 265.6 L285 296" strokeDasharray="8 7" />
          <path d="M279 288 L285 296 L291 288" />
          <path d="M80 219 L80 246 L104 303.6" strokeDasharray="8 7" />
          <path d="M97 302.3 L105.6 307.4 L108 297.7" />
        </g>
        <g className="stroke-chalk" strokeWidth={3.5}>
          <path d="M80 47 L80 74 L56 131.6" strokeDasharray="7 6" />
          <path d="M51.9 125.7 L54.4 135.4 L63 130.3" />
        </g>
      </g>

      {/* Khung dọc: ba cần gạt thường */}
      <Lever x={285} y={88} size={0.42} tilt={-TILT} />
      <Lever x={248} y={176.8} size={0.42} tilt={TILT} />
      <Lever x={322} y={176.8} size={0.42} tilt={TILT} />
      {[
        [285, 88],
        [248, 176.8],
        [322, 176.8],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle
            cx={x}
            cy={y}
            r={8}
            className={cn(CHALK, "fill-board stroke-chalk")}
            strokeWidth={2.5}
          />
          <circle cx={x} cy={y} r={2.5} className="fill-chalk" />
        </g>
      ))}
      <Ball x={285} y={36} gold />

      {/* Ba cốc, cốc B khoanh phấn vàng và có bàn tay chạm */}
      {CUPS.map(({ x, letter }) => (
        <g key={letter}>
          <g transform={`translate(${x} 292) scale(0.44)`} className={cn(CHALK, "stroke-chalk")}>
            <path d={CUP} className="fill-board-shade" strokeWidth={5.5} strokeLinejoin="round" />
            <ellipse rx={44} ry={12} className="fill-ink/50" strokeWidth={5.5} />
          </g>
          <text
            x={x}
            y={324.6}
            textAnchor="middle"
            className={cn(CHALK, "fill-chalk font-display text-[20px] font-extrabold")}
          >
            {letter}
          </text>
        </g>
      ))}
      <ellipse
        cx={285}
        cy={314}
        rx={34}
        ry={30}
        fill="none"
        className={cn(CHALK, "stroke-primary")}
        strokeWidth={4}
      />
      <path
        transform="translate(304 314) scale(2) translate(-11 -3.5)"
        d={HAND}
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Cột trái: công tắc trước và sau khi bi 1 đi qua */}
      <Lever x={80} y={74} size={0.48} tilt={TILT} />
      <path
        d={ARROW}
        transform={`translate(80 246) scale(0.48) rotate(${TILT})`}
        fill="none"
        className={cn(CHALK, "stroke-chalk")}
        strokeWidth={5}
        strokeDasharray="8 7"
        strokeLinejoin="round"
      />
      <Lever x={80} y={246} size={0.48} tilt={-TILT} />
      {[74, 246].map((y) => (
        <g key={y}>
          <circle
            cx={80}
            cy={y}
            r={12}
            className={cn(CHALK, "fill-primary stroke-chalk")}
            strokeWidth={2.2}
          />
          <path
            d={FLIP_ICON}
            transform={`translate(80 ${y}) scale(0.62)`}
            fill="none"
            className="stroke-ink"
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <path
        d={FLIP_ICON}
        transform="translate(80 168) scale(1.3)"
        fill="none"
        className={cn(CHALK, "stroke-chalk")}
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Ball x={80} y={36} />
      <Ball x={80} y={208} gold />
      <g className="fill-ink font-display text-[14px] font-extrabold" textAnchor="middle">
        <text x={80} y={41}>
          1
        </text>
        <text x={80} y={213}>
          2
        </text>
      </g>
      <circle cx={94} cy={196} r={8} className="fill-ink stroke-chalk" strokeWidth={1.6} />
      <text
        x={94}
        y={200.5}
        textAnchor="middle"
        className="fill-primary font-display text-[12px] font-extrabold"
      >
        ?
      </text>

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
