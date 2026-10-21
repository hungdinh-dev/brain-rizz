import { type BalanceItem, WRONG_ANSWER_LOCK_MS } from "@brain-rizz/shared";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import { ITEM_ART, partKey } from "../_shared/items";

/** Nét phấn sần: filter SVG #chalk khai báo một lần trong <ChalkDefs /> của App. */
const CHALK = "filter-[url(#chalk)]";

/** Thẻ thu nhỏ 56×78; tâm cột của nửa trái (Xem), nửa phải lệch 280; tâm hai hàng. */
const COLS = [70, 140, 210];
const RIGHT = 280;
const ROWS = [123, 217];
const ITEM_SIZE = 0.42;

/** Màu phấn của từng vật (chỉ vẽ nét viền, như vẽ phấn lên bảng). */
const ITEM_STROKE: Partial<Record<BalanceItem, string>> = {
  apple: "stroke-pink",
  banana: "stroke-sun",
  carrot: "stroke-identify",
};

/** Bàn 3×2 theo thứ tự ô: hàng trên táo, chuối, cà rốt; hàng dưới cà rốt, táo, chuối. */
const BOARD: BalanceItem[] = ["apple", "banana", "carrot", "carrot", "apple", "banana"];
/** Nửa phải: hai thẻ táo (ô 0 là thẻ đề, ô 4 là thẻ được chạm) ngửa trong vòng vàng. */
const PAIR = [0, 4];
const CELLS = [0, 1, 2, 3, 4, 5];

const cellX = (i: number, dx = 0) => (COLS[i % 3] ?? 0) + dx;
const cellY = (i: number) => ROWS[Math.floor(i / 3)] ?? 0;

/** Vật vẽ bằng nét phấn: chỉ các đường viền chính của hình chung với Cân não. */
function ChalkItem({
  item,
  x,
  y,
  size = ITEM_SIZE,
  width = 7,
}: {
  item: BalanceItem;
  x: number;
  y: number;
  size?: number;
  width?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size})`}
      className={cn(CHALK, "fill-none", ITEM_STROKE[item] ?? "stroke-chalk")}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ITEM_ART[item].map((part) =>
        part.kind === "path" && part.opacity === undefined ? (
          <path key={partKey(part)} d={part.d} />
        ) : null,
      )}
    </g>
  );
}

/** Thẻ ngửa: khung phấn trong suốt. */
function FaceCard({ x, y }: { x: number; y: number }) {
  return (
    <rect
      x={x - 28}
      y={y - 39}
      width={56}
      height={78}
      rx={10}
      strokeWidth={3}
      className={cn(CHALK, "fill-chalk/10 stroke-chalk/85")}
    />
  );
}

/** Thẻ úp: nền tối, khung trong hồng, dấu "?". */
function BackCard({ x, y }: { x: number; y: number }) {
  return (
    <g className={CHALK}>
      <rect
        x={x - 28}
        y={y - 39}
        width={56}
        height={78}
        rx={10}
        strokeWidth={3}
        className="fill-sticker/45 stroke-chalk/80"
      />
      <rect
        x={x - 22}
        y={y - 33}
        width={44}
        height={66}
        rx={6}
        strokeWidth={2}
        className="fill-none stroke-pink/75"
      />
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fontSize={30}
        className="fill-chalk/85 font-display font-extrabold"
      >
        ?
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Lật cặp (màn Hướng dẫn, thẻ game), theo artboard PairFlipHowTo.
 * Nửa trái "Xem" (mắt): lưới 3×2, cả sáu thẻ ngửa (hai táo, hai chuối, hai cà rốt).
 * Nửa phải "Chạm" (ngón tay): cùng lưới đã úp; thẻ đề táo góc trên trái và thẻ táo giữa hàng
 * dưới được chạm, cả hai ngửa trong vòng vàng; dải chấm 1 đặc, 1 rỗng.
 * Góc dưới phải: thẻ cà rốt có dấu X → mũi tên cong → thẻ úp, "1,5 s": chạm sai thì thẻ úp lại.
 * Đặt trên nền bảng (`bg-board`); chữ số trong hình là ký hiệu, không cần dịch.
 */
export function PairFlipHowTo({ className }: { className?: string }) {
  const fmt = useNumberFormat(1);
  const lockSeconds = `${fmt(WRONG_ANSWER_LOCK_MS / 1000)} s`;
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Nửa trái: mắt, sáu thẻ ngửa */}
      <path
        d={EYE_PATH}
        transform="translate(140 44) scale(0.737)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5.4}
        strokeLinejoin="round"
      />
      <circle
        cx={140}
        cy={44}
        r={9}
        strokeWidth={3.5}
        className={cn(CHALK, "fill-none stroke-chalk")}
      />
      <circle cx={140} cy={44} r={4} className="fill-chalk" />
      {CELLS.map((i) => (
        <g key={i}>
          <FaceCard x={cellX(i)} y={cellY(i)} />
          <ChalkItem item={BOARD[i] ?? "apple"} x={cellX(i)} y={cellY(i)} />
        </g>
      ))}

      {/* Mũi tên phấn ở giữa */}
      <path
        d="M252 176 C268 168 288 168 304 176 M293 164 L305 176 L293 188"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nửa phải: ngón tay, dải chấm, bàn đã úp, cặp táo trong vòng vàng */}
      <path
        d={HAND_PATH}
        transform="translate(420 40) scale(1.6) translate(-12.3 -12)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={409} cy={68} r={6} className="fill-chalk" />
      <circle cx={431} cy={68} r={5} strokeWidth={2.5} className="fill-none stroke-chalk" />
      {CELLS.map((i) =>
        PAIR.includes(i) ? (
          <g key={i}>
            <FaceCard x={cellX(i, RIGHT)} y={cellY(i)} />
            <ChalkItem item={BOARD[i] ?? "apple"} x={cellX(i, RIGHT)} y={cellY(i)} />
            <rect
              x={cellX(i, RIGHT) - 32}
              y={cellY(i) - 43}
              width={64}
              height={86}
              rx={13}
              strokeWidth={4}
              className={cn(CHALK, "fill-none stroke-primary")}
            />
          </g>
        ) : (
          <BackCard key={i} x={cellX(i, RIGHT)} y={cellY(i)} />
        ),
      )}
      <path
        d={HAND_PATH}
        transform="translate(436 240) scale(2.2) translate(-11 -3.5)"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Góc dưới phải: chạm sai thì thẻ úp lại sau thời gian khoá */}
      <rect
        x={394}
        y={300}
        width={26}
        height={36}
        rx={6}
        strokeWidth={2.5}
        className={cn(CHALK, "fill-chalk/10 stroke-chalk/85")}
      />
      <ChalkItem item="carrot" x={407} y={318} size={0.2} width={12} />
      <path
        d="M399 310 L415 326 M415 310 L399 326"
        className="fill-none stroke-chalk"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M399 310 L415 326 M415 310 L399 326"
        className="fill-none stroke-destructive"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d="M426 308 C436 292 456 292 466 306 M465.2 297.1 L466 306 L457.9 302.3"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className={CHALK}>
        <rect
          x={474}
          y={300}
          width={26}
          height={36}
          rx={6}
          strokeWidth={2.5}
          className="fill-sticker/45 stroke-chalk/80"
        />
        <text
          x={487}
          y={324}
          textAnchor="middle"
          fontSize={18}
          className="fill-chalk font-display font-extrabold"
        >
          ?
        </text>
      </g>
      <text
        x={446}
        y={340}
        textAnchor="middle"
        fontSize={16}
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
      >
        {lockSeconds}
      </text>
    </svg>
  );
}
