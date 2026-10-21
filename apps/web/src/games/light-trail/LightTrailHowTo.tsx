import { cn } from "@/lib/utils";
import { HAND_PATH } from "../_shared/icons";

/** Lưới 3×3 thu nhỏ: ô 52, bước 66; góc trên trái của nửa trái (Xem) và nửa phải (Chạm lại). */
const CELL = 52;
const STEP = 66;
const TOP = 84;
const WATCH_X = 48;
const REPEAT_X = 328;
/** Nửa trái: ô số 3 đang sáng (ô 5) vẽ riêng. */
const LIT_CELL = 5;
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Nét phấn sần: filter SVG #chalk khai báo một lần trong <ChalkDefs /> của App. */
const CHALK = "filter-[url(#chalk)]";

function Grid({ x, skip }: { x: number; skip?: number }) {
  return (
    <g className={cn(CHALK, "fill-board-shade stroke-chalk/80")} strokeWidth={3}>
      {CELLS.filter((i) => i !== skip).map((i) => (
        <rect
          key={i}
          x={x + (i % 3) * STEP}
          y={TOP + Math.floor(i / 3) * STEP}
          width={CELL}
          height={CELL}
          rx={10}
        />
      ))}
    </g>
  );
}

/**
 * Hình minh hoạ Theo dấu ánh đèn (màn Hướng dẫn, thẻ game), theo artboard LightTrailHowTo.
 * Nửa trái "Xem": ba ô 6 → 1 → 5 đánh số 1, 2, 3 nối bằng nét đứt, ô số 3 đang sáng.
 * Nửa phải "Chạm lại": ngón tay chạm ô số 1, ô đó có huy hiệu "1", một trên ba chấm đã đặc.
 * Góc dưới phải: huy hiệu tua ngược cạnh dãy 3 → 2 → 1 (luật Siêu khó).
 * Đặt trên nền bảng (`bg-board`); chữ số trong hình là ký hiệu, không cần dịch.
 */
export function LightTrailHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="38 15 484 330" aria-hidden className={cn("overflow-visible", className)}>
      {/* Nửa trái: mắt, lưới, đường đi 1 → 2 → 3 */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M112 44 C121 29 131 25 140 25 C149 25 159 29 168 44 C159 59 149 63 140 63 C131 63 121 59 112 44 Z"
          strokeWidth={4}
        />
        <circle cx={140} cy={44} r={9} strokeWidth={3.5} />
      </g>
      <circle cx={140} cy={44} r={4} className="fill-chalk" />
      <Grid x={WATCH_X} skip={LIT_CELL} />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 222 L122 134 M159 129 L174 144" strokeDasharray="7 6" />
        <path d="M113.9 141.4 L122 134 L123.6 144.9 M170.8 133.5 L174 144 L163.5 140.8" />
      </g>
      <g
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
        fontSize={28}
        textAnchor="middle"
      >
        <text x={74} y={252}>
          1
        </text>
        <text x={140} y={120}>
          2
        </text>
      </g>
      <path
        d="M240 176 L243 176 M172 176 L169 176 M206 142 L206 139 M206 210 L206 213 M235 205 L242 212 M177 205 L170 212 M235 147 L242 140 M177 147 L170 140"
        className={cn(CHALK, "fill-none stroke-primary")}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect
        x={177}
        y={147}
        width={58}
        height={58}
        rx={11}
        strokeWidth={5}
        className={cn(CHALK, "fill-primary stroke-chalk")}
      />
      <text
        x={206}
        y={187}
        textAnchor="middle"
        fontSize={30}
        className="fill-primary-foreground font-display font-extrabold"
      >
        3
      </text>

      {/* Mũi tên phấn ở giữa */}
      <path
        d="M252 176 C268 168 288 168 304 176 M293 164 L305 176 L293 188"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nửa phải: ngón tay, chấm tiến độ, lưới, ô số 1 đã chạm */}
      <path
        d={HAND_PATH}
        transform="translate(420 40) scale(1.6) translate(-12.3 -12)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={398} cy={68} r={6} className="fill-chalk" />
      <g className="fill-none stroke-chalk" strokeWidth={2.5}>
        <circle cx={420} cy={68} r={5} />
        <circle cx={442} cy={68} r={5} />
      </g>
      <Grid x={REPEAT_X} />
      <rect
        x={333}
        y={221}
        width={42}
        height={42}
        rx={7}
        strokeWidth={3}
        className={cn(CHALK, "fill-none stroke-primary")}
      />
      <circle cx={336} cy={224} r={12} className="fill-chalk" />
      <text
        x={336}
        y={230}
        textAnchor="middle"
        fontSize={17}
        className="fill-ink font-display font-extrabold"
      >
        1
      </text>
      <path
        d={HAND_PATH}
        transform="translate(362 246) scale(2.2) translate(-11 -3.5)"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Góc dưới phải: luật Siêu khó */}
      <circle
        cx={392}
        cy={318}
        r={16}
        strokeWidth={2.5}
        className={cn(CHALK, "fill-memorize stroke-chalk")}
      />
      <path
        d="M391.5 309 L381 318 L391.5 327 Z M403 309 L392.5 318 L403 327 Z"
        className="fill-ink"
      />
      <text
        x={418}
        y={326}
        fontSize={22}
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
      >
        3 → 2 → 1
      </text>
    </svg>
  );
}
