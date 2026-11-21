import { type ShadowItem, shadowParts } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import { ITEM_ART, placeParts } from "./art";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Thẻ phấn của một bóng (khung chữ nhật bo góc, nền phấn mờ). */
export function ChalkCard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={12}
      filter="url(#chalk)"
      className="fill-chalk/10 stroke-chalk"
      strokeOpacity={0.85}
      strokeWidth={3}
    />
  );
}

/** Các phần hình của một biến thể, mỗi phần ở phía ngược vẽ bằng ảnh gương qua x = 0. */
function Parts({
  item,
  variant,
  colored,
}: {
  item: ShadowItem;
  variant: number;
  colored: boolean;
}) {
  return placeParts(item, shadowParts(item, variant)).map(({ art, mirror }, i) => (
    // Danh sách phần cố định theo (vật, biến thể) nên dùng chỉ số làm key là an toàn.
    // biome-ignore lint/suspicious/noArrayIndexKey: danh sách cố định
    <g key={i} transform={mirror ? "scale(-1 1)" : undefined}>
      {art.shapes.map((shape) =>
        shape.kind === "fill" ? (
          <path key={shape.d} d={shape.d} fill={colored ? shape.fill : undefined} />
        ) : (
          <path
            key={shape.d}
            d={shape.d}
            fill="none"
            strokeWidth={colored ? shape.width : shape.width + 4}
          />
        ),
      )}
    </g>
  ));
}

/** Bóng đen viền phấn (như bóng ở nền tối của game) đặt tại (x, y), cỡ `scale`, xoay `rotate`. */
export function Shadow({
  item,
  variant,
  x,
  y,
  scale,
  rotate = 0,
}: {
  item: ShadowItem;
  variant: number;
  x: number;
  y: number;
  scale: number;
  rotate?: number;
}) {
  const [ox, oy] = ITEM_ART[item].offset;
  const transform = `translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${ox} ${oy})`;
  return (
    <>
      <g
        transform={transform}
        className="fill-chalk stroke-chalk"
        strokeWidth={14}
        strokeLinejoin="round"
      >
        <Parts item={item} variant={variant} colored={false} />
      </g>
      <g
        transform={transform}
        className="fill-ink stroke-ink"
        strokeWidth={6}
        strokeLinejoin="round"
      >
        <Parts item={item} variant={variant} colored={false} />
      </g>
    </>
  );
}

/** Đồ vật có màu (hình gốc), viền mực. */
export function ColoredItem({
  item,
  x,
  y,
  scale,
}: {
  item: ShadowItem;
  x: number;
  y: number;
  scale: number;
}) {
  const art = ITEM_ART[item];
  const [ox, oy] = art.offset;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) translate(${ox} ${oy})`}>
      <g className="stroke-ink" strokeWidth={6} strokeLinejoin="round">
        <Parts item={item} variant={0} colored />
      </g>
      {art.decor.map((decor) =>
        decor.kind === "fill" ? (
          <path
            key={decor.d}
            d={decor.d}
            fill={decor.fill === "ink" ? undefined : decor.fill}
            className={decor.fill === "ink" ? "fill-ink" : undefined}
          />
        ) : (
          <path
            key={decor.d}
            d={decor.d}
            fill="none"
            stroke={decor.color === "ink" ? undefined : decor.color}
            className={decor.color === "ink" ? "stroke-ink" : undefined}
            strokeWidth={decor.width}
            strokeOpacity={decor.opacity}
            strokeLinecap="round"
          />
        ),
      )}
    </g>
  );
}

/** Ngón tay chạm (đường 24×24). */
const FINGER =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/**
 * Hình minh hoạ Bóng của ai (màn Hướng dẫn, thẻ game), theo artboard ShadowMatchHowTo: nửa trái
 * (biểu tượng mắt) là thẻ giấy có ấm trà màu xanh; mũi tên phấn; nửa phải (biểu tượng ngón tay) là
 * ba bóng (ấm không vòi, ấm đúng, cây xương rồng), ngón tay chạm bóng ấm đúng có vòng vàng; góc
 * dưới phải: bóng ấm → mũi tên xoay → cùng bóng nằm ngang. Đặt trên nền bảng (`bg-board`).
 */
export function ShadowMatchHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Biểu tượng mắt */}
      <g {...CHALK} className="stroke-chalk">
        <path
          d="M112 44 C121 29 131 25 140 25 C149 25 159 29 168 44 C159 59 149 63 140 63 C131 63 121 59 112 44 Z"
          strokeWidth={4}
        />
        <circle cx={140} cy={44} r={9} strokeWidth={3.5} />
      </g>
      <circle cx={140} cy={44} r={4} className="fill-chalk" />

      {/* Thẻ đề: giấy, viền mực, viền trong cam Nhận diện, bóng sàn, ấm trà có màu */}
      <rect
        x={58}
        y={92}
        width={164}
        height={190}
        rx={16}
        filter="url(#chalk)"
        className="fill-paper stroke-ink"
        strokeWidth={4}
      />
      <rect
        x={66}
        y={100}
        width={148}
        height={174}
        rx={11}
        fill="none"
        className="stroke-identify"
        strokeWidth={4}
      />
      <ellipse cx={140} cy={250} rx={54} ry={8} className="fill-ink" opacity={0.12} />
      <ColoredItem item="teapot" x={140} y={182} scale={0.9} />

      {/* Mũi tên phấn sang các bóng */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={5}>
        <path d="M246 186 C262 178 282 178 298 186" />
        <path d="M287 174 L299 186 L287 198" />
      </g>

      {/* Biểu tượng ngón tay */}
      <path
        d={FINGER}
        transform="translate(420 40) scale(1.6) translate(-12.3 -12)"
        filter="url(#chalk)"
        className="stroke-chalk"
        fill="none"
        strokeWidth={2.3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Ba bóng: ấm không vòi, ấm đúng (vòng vàng), cây xương rồng */}
      <ChalkCard x={307} y={112} w={74} h={96} />
      <ChalkCard x={383} y={112} w={74} h={96} />
      <ChalkCard x={459} y={112} w={74} h={96} />
      <Shadow item="teapot" variant={1} x={344} y={160} scale={0.4} />
      <Shadow item="teapot" variant={0} x={420} y={160} scale={0.4} />
      <Shadow item="cactus" variant={0} x={496} y={160} scale={0.4} />
      <rect
        x={377}
        y={106}
        width={86}
        height={108}
        rx={16}
        filter="url(#chalk)"
        className="stroke-primary"
        fill="none"
        strokeWidth={4}
      />
      <path
        d={FINGER}
        transform="translate(436 222) scale(2.2) translate(-11 -3.5)"
        filter="url(#chalk)"
        className="fill-board stroke-chalk"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Góc dưới phải: bóng ấm xoay 90° vẫn đúng */}
      <ChalkCard x={362} y={290} w={40} h={44} />
      <Shadow item="teapot" variant={0} x={382} y={312} scale={0.2} />
      <g {...CHALK} className="stroke-chalk" strokeWidth={3}>
        <path d="M410 300 C420 286 440 286 450 300" />
        <path d="M449.2 291.1 L450 300 L441.9 296.3" />
      </g>
      <ChalkCard x={458} y={290} w={40} h={44} />
      <Shadow item="teapot" variant={0} x={478} y={312} scale={0.2} rotate={90} />
    </svg>
  );
}
