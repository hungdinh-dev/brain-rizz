import { cn } from "@/lib/utils";

/**
 * Màu giấy tờ tiền trong hình, lấy từ bảng `BILLS` của CashCountScene (không import thẳng từ scene
 * được: scene kéo theo Phaser, chỉ được tải lười khi vào vòng chơi).
 */
export const BILL_20K = { width: 258, fill: "#9cc2f2", label: "20.000" };
export const BILL_10K = { width: 248, fill: "#f0cf72", label: "10.000" };
export const BILL_5K = { width: 236, fill: "#c3b2ee", label: "5.000" };

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Số thứ tự khoanh phấn: ① xấp tiền, ② dấu bằng, ③ thẻ được chạm. */
const ORDER = [
  { n: 1, x: 62, y: 52 },
  { n: 2, x: 291, y: 136 },
  { n: 3, x: 300, y: 264 },
];

/** Bốn thẻ đáp án lưới 2×2; thẻ 35.000 (được chạm) vẽ riêng có viền vàng. */
const CARDS = [
  { x: 322, y: 106, label: "25.000" },
  { x: 436, y: 106, label: "30.000" },
  { x: 436, y: 180, label: "40.000" },
];

/** Tờ tiền nhãn dán: giấy luôn sáng nên chữ số dùng mực đậm ở cả hai chủ đề. Vẽ ở tỉ lệ 0,5. */
export function Bill(props: {
  x: number;
  y: number;
  angle: number;
  bill: { width: number; fill: string; label: string };
}) {
  const { x, y, angle, bill } = props;
  const half = bill.width / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(0.5)`}>
      <rect x={-half} y={-56} width={bill.width} height={128} rx={16} className="fill-sticker" />
      <rect
        x={-half}
        y={-64}
        width={bill.width}
        height={128}
        rx={16}
        fill={bill.fill}
        className="stroke-sticker"
        strokeWidth={5}
      />
      <rect
        x={-half + 11}
        y={-53}
        width={bill.width - 22}
        height={106}
        rx={9}
        className="fill-none stroke-sticker"
        strokeOpacity={0.3}
        strokeWidth={2.5}
      />
      <ellipse
        rx={half - 18}
        ry={40}
        className="fill-white stroke-sticker"
        fillOpacity={0.55}
        strokeOpacity={0.3}
        strokeWidth={2.5}
      />
      <text
        y={20}
        textAnchor="middle"
        fontSize={56}
        className="fill-ink font-display font-extrabold"
      >
        {bill.label}
      </text>
    </g>
  );
}

export function Card(props: { x: number; y: number; label: string }) {
  const { x, y, label } = props;
  return (
    <g>
      <rect x={x} y={y + 4} width={100} height={52} rx={12} className="fill-sticker" />
      <rect
        x={x}
        y={y}
        width={100}
        height={52}
        rx={12}
        className="fill-card stroke-card-foreground"
        strokeWidth={3}
      />
      <text
        x={x + 50}
        y={y + 34}
        textAnchor="middle"
        fontSize={24}
        className="fill-card-foreground font-display font-extrabold"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Đếm tiền nhanh (màn Hướng dẫn, thẻ game), theo artboard `CashCountHowTo`: ba tờ
 * 20.000, 10.000, 5.000 xếp dọc có dấu cộng phấn, ngoặc nhọn gom cả ba, dấu bằng, rồi lưới bốn thẻ;
 * ngón tay chạm thẻ 35.000 viền vàng. Đặt trên nền bảng (`bg-board`).
 */
export function CashCountHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      <Bill x={150} y={84} angle={-4} bill={BILL_20K} />
      <Bill x={158} y={172} angle={3} bill={BILL_10K} />
      <Bill x={148} y={260} angle={-2} bill={BILL_5K} />

      {/* Dấu cộng giữa các tờ, ngoặc nhọn gom xấp tiền, dấu bằng */}
      <g className={CHALK} strokeWidth={3.5} strokeLinecap="round">
        <path d="M54 128 L70 128 M62 120 L62 136" />
        <path d="M54 216 L70 216 M62 208 L62 224" />
        <path d="M232 52 C250 52 248 76 248 108 C248 150 250 166 266 172 C250 178 248 194 248 236 C248 268 250 292 232 292" />
        <path d="M280 165 L302 165 M280 179 L302 179" />
      </g>

      {CARDS.map((card) => (
        <Card key={card.label} {...card} />
      ))}
      {/* Thẻ được chạm: viền vàng, tia phấn vàng */}
      <rect
        x={316}
        y={174}
        width={112}
        height={64}
        rx={16}
        className="fill-none stroke-sticker"
        strokeWidth={9}
      />
      <rect
        x={316}
        y={174}
        width={112}
        height={64}
        rx={16}
        className="fill-none stroke-primary"
        strokeWidth={5}
      />
      <Card x={322} y={180} label="35.000" />
      <path
        d="M308 206 L296 206 M310 182 L302 174 M310 230 L302 238"
        className="fill-none stroke-primary filter-[url(#chalk)]"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        transform="translate(390 222) scale(2.2) translate(-11 -3.5)"
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
