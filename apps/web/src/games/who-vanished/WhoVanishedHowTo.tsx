import type { WhoVanishedItem } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import { ITEM_ART, partKey } from "./items";
import { EYE_PATH, HAND_PATH } from "./shapes";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Một vật vẽ từ bảng hình chung với scene (items.ts), viền mực. */
function Item({ item, x, y, size }: { item: WhoVanishedItem; x: number; y: number; size: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size})`}
      className="text-ink"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ITEM_ART[item].map((part) => {
        const key = partKey(part);
        if (part.kind === "stroke") {
          return (
            <path
              key={key}
              d={part.d}
              fill="none"
              stroke={part.color}
              strokeWidth={part.width}
              opacity={part.opacity}
            />
          );
        }
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

/** Khay 2×2 thu nhỏ: ô 62, bước 70, góc khung (x, 72). `blank` = ô trống có dấu "?". */
const TRAY_ITEMS: WhoVanishedItem[] = ["apple", "carrot", "watermelon", "banana"];

function Tray({ x, blank }: { x: number; blank?: number }) {
  return (
    <g>
      <rect
        x={x}
        y={72}
        width={148}
        height={148}
        rx={16}
        className={cn(CHALK, "fill-none stroke-memorize")}
        strokeWidth={3.5}
      />
      <g className={cn(CHALK, "fill-board-shade stroke-chalk/80")} strokeWidth={3}>
        {TRAY_ITEMS.map((item, i) =>
          i === blank ? null : (
            <rect
              key={item}
              x={x + 8 + (i % 2) * 70}
              y={80 + Math.floor(i / 2) * 70}
              width={62}
              height={62}
              rx={10}
            />
          ),
        )}
      </g>
      {TRAY_ITEMS.map((item, i) =>
        i === blank ? null : (
          <Item
            key={item}
            item={item}
            x={x + 39 + (i % 2) * 70}
            y={111 + Math.floor(i / 2) * 70}
            size={0.44}
          />
        ),
      )}
    </g>
  );
}

const CHOICES: { item: WhoVanishedItem; x: number }[] = [
  { item: "mushroom", x: 340 },
  { item: "banana", x: 400 },
  { item: "strawberry", x: 460 },
];

/**
 * Hình minh hoạ Ai vừa biến mất (màn Hướng dẫn, thẻ game), theo artboard WhoVanishedHowTo.
 * Trái (mắt): khay 2×2 táo, cà rốt, miếng dưa hấu, chuối; dưới là thanh xem đang rút.
 * Giữa: mắt nhắm trên tấm rèm hồng đang hạ, mũi tên phấn sang phải.
 * Phải (ngón tay): cùng khay, ô dưới phải trống có dấu "?"; ba thẻ nấm, chuối, dâu tây; thẻ chuối
 * được khoanh phấn vàng, có bàn tay chỉ vào và mũi tên nét đứt bay về ô trống.
 * Góc dưới trái: huy hiệu đổi chỗ cạnh hai ô táo, chuối đổi cho nhau (luật Siêu khó).
 * Đặt trên nền bảng (`bg-board`); dấu "?" là ký hiệu, không cần dịch.
 */
export function WhoVanishedHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Trái: mắt, khay, thanh xem */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={EYE_PATH} transform="translate(120 40) scale(0.737)" strokeWidth={5.4} />
        <circle cx={120} cy={40} r={9} strokeWidth={3.5} />
      </g>
      <circle cx={120} cy={40} r={4} className="fill-chalk" />
      <Tray x={46} />
      <rect
        x={60}
        y={234}
        width={120}
        height={10}
        rx={5}
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.5}
      />
      <rect x={60} y={234} width={72} height={10} rx={5} className={cn(CHALK, "fill-memorize")} />

      {/* Giữa: mắt nhắm, rèm hạ, mũi tên */}
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M236 36 C246 50 254 54 262 54 C270 54 278 50 288 36" strokeWidth={4} />
        <path d="M246 47 L241 57 M262 54 L262 65 M278 47 L283 57" strokeWidth={3.5} />
      </g>
      <path
        d="M226 86 L298 86"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M232 88 L292 88 L292 146 C288 155 276 155 272 146 C268 155 256 155 252 146 C248 155 236 155 232 146 Z"
        className={cn(CHALK, "fill-memorize stroke-chalk")}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M252 92 L252 142 M272 92 L272 142"
        className="fill-none stroke-ink/35"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M234 186 C252 176 274 176 292 186" />
        <path d="M281 174 L293 186 L281 198" />
      </g>

      {/* Phải: ngón tay, khay có ô trống, hàng thẻ */}
      <path
        d={HAND_PATH}
        transform="translate(400 40) scale(1.6) translate(-12.3 -12)"
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Tray x={326} blank={3} />
      <rect
        x={404}
        y={150}
        width={62}
        height={62}
        rx={10}
        className={cn(CHALK, "fill-memorize/20 stroke-chalk")}
        strokeWidth={3}
        strokeDasharray="7 6"
      />
      <text
        x={435}
        y={194}
        textAnchor="middle"
        fontSize={38}
        className={cn(CHALK, "fill-chalk font-display font-extrabold")}
      >
        ?
      </text>
      {CHOICES.map(({ item, x }) => (
        <g key={item}>
          <rect x={x - 27} y={262} width={54} height={54} rx={10} className="fill-ink" />
          <rect
            x={x - 27}
            y={259}
            width={54}
            height={54}
            rx={10}
            className="fill-paper stroke-ink"
            strokeWidth={3}
          />
          <Item item={item} x={x} y={286} size={0.4} />
        </g>
      ))}
      <ellipse
        cx={400}
        cy={286}
        rx={40}
        ry={36}
        className={cn(CHALK, "fill-none stroke-primary")}
        strokeWidth={4}
      />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M404 248 C410 236 420 226 428 220" strokeDasharray="6 5" />
        <path d="M417.4 220.2 L429 219 L424.6 229.8" />
      </g>
      <path
        d={HAND_PATH}
        transform="translate(420 304) scale(2) translate(-11 -3.5)"
        className={cn(CHALK, "fill-board stroke-chalk")}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Góc dưới trái: luật Siêu khó (đổi chỗ) */}
      <circle
        cx={58}
        cy={318}
        r={17}
        className={cn(CHALK, "fill-memorize stroke-chalk")}
        strokeWidth={2.5}
      />
      <path
        d="M49 313 L63 313 M67 323 L53 323"
        className="fill-none stroke-ink"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M61 308 L69 313 L61 318 Z M55 318 L47 323 L55 328 Z" className="fill-ink" />
      <g className={cn(CHALK, "fill-board-shade stroke-chalk/80")} strokeWidth={2.5}>
        <rect x={92} y={300} width={30} height={30} rx={6} />
        <rect x={150} y={300} width={30} height={30} rx={6} />
      </g>
      <Item item="apple" x={107} y={315} size={0.22} />
      <Item item="banana" x={165} y={315} size={0.22} />
      <g
        className={cn(CHALK, "fill-none stroke-chalk")}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M110 294 C122 280 150 280 162 294" />
        <path d="M153 291 L162 294 L160.6 284.6" />
        <path d="M162 336 C150 350 122 350 110 336" />
        <path d="M119 338.8 L110 336 L111.4 345.4" />
      </g>
    </svg>
  );
}
