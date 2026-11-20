import { cn } from "@/lib/utils";

/**
 * Màu thân bóng trong hình, lấy từ `BALLOON_COLORS` của NumberBalloonsScene (không import thẳng
 * từ scene được: scene kéo theo Phaser, chỉ được tải lười khi vào vòng chơi).
 */
const PINK = "#ffadc6";
const YELLOW = "#ffd166";
const LAVENDER = "#c7b6f0";
const MINT = "#9be3c0";
/** Bốn màu thân bóng, dùng lại ở NumberBalloonsDemo. */
export const BALLOON_FILL = { pink: PINK, yellow: YELLOW, lavender: LAVENDER, mint: MINT } as const;

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Số thứ tự khoanh phấn cạnh từng bóng: 3 → ①, 5 → ②, 8 → ③, 12 → ④. */
const ORDER = [
  { n: 1, x: 62, y: 226 },
  { n: 2, x: 476, y: 252 },
  { n: 3, x: 84, y: 118 },
  { n: 4, x: 476, y: 118 },
];

/** Thân bóng luôn sáng nên chữ số dùng mực đậm ở cả hai chủ đề; viền theo màu viền nhãn dán. */
export function Balloon(props: {
  x: number;
  y: number;
  fill: string;
  value: number;
  scale?: number;
}) {
  const { x, y, fill, value, scale } = props;
  return (
    <g transform={`translate(${x} ${y})${scale ? ` scale(${scale})` : ""}`}>
      <path
        d="M0 46 C5 52 -5 58 0 64 C3 68 1 71 0 72"
        className="fill-none stroke-chalk"
        strokeOpacity={0.85}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <ellipse cy={4} rx={32} ry={38} className="fill-sticker" />
      <path
        d="M-6 46 L0 36 L6 46 Z"
        fill={fill}
        className="stroke-sticker"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <ellipse rx={32} ry={38} fill={fill} className="stroke-sticker" strokeWidth={3.5} />
      <ellipse
        cx={-14}
        cy={-17}
        rx={5}
        ry={10}
        transform="rotate(28 -14 -17)"
        className="fill-white"
        opacity={0.55}
      />
      <text
        y={11}
        textAnchor="middle"
        fontSize={30}
        className="fill-ink font-display font-extrabold"
      >
        {value}
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Bóng bay số (màn Hướng dẫn, thẻ game): bốn bóng 8, 12, 3, 5 có số thứ tự khoanh
 * phấn và mũi tên nét đứt nối 3 → 5 → 8 → 12; ngón tay đang nổ quả 3; khay thứ tự phía trên đã ghi 3.
 * Đặt trên nền bảng (`bg-board`).
 */
export function NumberBalloonsHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="40 4 464 348" aria-hidden className={cn("overflow-visible", className)}>
      {/* Khay thứ tự: ô đầu đã có 3, ba ô trống */}
      <rect x={162} y={18} width={50} height={50} rx={10} className="fill-sticker" />
      <rect
        x={162}
        y={14}
        width={50}
        height={50}
        rx={10}
        className="fill-card stroke-card-foreground"
        strokeWidth={3}
      />
      <text
        x={187}
        y={50}
        textAnchor="middle"
        fontSize={30}
        className="fill-card-foreground font-display font-extrabold"
      >
        3
      </text>
      <g
        className="fill-board-shade stroke-chalk filter-[url(#chalk)]"
        strokeOpacity={0.8}
        strokeWidth={2.5}
        strokeDasharray="7 5"
      >
        {[224, 286, 348].map((x) => (
          <rect key={x} x={x} y={14} width={50} height={50} rx={10} />
        ))}
      </g>

      {/* Mũi tên phấn nét đứt 3 → 5 → 8 → 12 */}
      <g className={CHALK} strokeWidth={3} strokeLinecap="round" strokeDasharray="7 6">
        <path d="M196 270 L358 270" />
        <path d="M372 232 L202 159" />
        <path d="M196 128 L358 128" />
      </g>
      <g className={CHALK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M350 262 L362 270 L350 278" />
        <path d="M205.8 167.4 L198 157 L210.9 155.5" />
        <path d="M350 120 L362 128 L350 136" />
      </g>

      <Balloon x={150} y={128} fill={YELLOW} value={8} />
      <Balloon x={410} y={128} fill={LAVENDER} value={12} />
      <Balloon x={410} y={262} fill={MINT} value={5} />

      {/* Quả 3 đang nổ dưới ngón tay: vòng "bụp", tia, mảnh vỡ */}
      <circle
        cx={150}
        cy={262}
        r={54}
        className={CHALK}
        strokeOpacity={0.8}
        strokeWidth={2.5}
        strokeDasharray="6 6"
      />
      <path
        d="M150 200 L150 190 M88 262 L78 262 M212 262 L222 262 M106 218 L99 211 M194 218 L201 211 M106 306 L99 313"
        className="fill-none stroke-primary filter-[url(#chalk)]"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Balloon x={150} y={262} fill={PINK} value={3} scale={1.12} />
      <g fill={PINK} className="stroke-sticker" strokeWidth={2} strokeLinejoin="round">
        <path d="M98 236 L108 228 L110 242 Z" />
        <path d="M196 244 L208 246 L200 256 Z" />
        <path d="M112 296 L122 304 L108 306 Z" />
      </g>
      <path
        transform="translate(170 284) scale(2.2) translate(-11 -3.5)"
        d="M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z"
        className="fill-board stroke-chalk filter-[url(#chalk)]"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Số thứ tự khoanh phấn */}
      {ORDER.map(({ n, x, y }) => (
        <g key={n} className="filter-[url(#chalk)]">
          <circle cx={x} cy={y} r={13} className="fill-board stroke-chalk" strokeWidth={2.5} />
          <text
            x={x}
            y={y + 6}
            textAnchor="middle"
            fontSize={18}
            className="fill-chalk font-display font-extrabold"
          >
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}
