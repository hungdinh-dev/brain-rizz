import { cn } from "@/lib/utils";

/**
 * Nền thẻ đã chọn, lấy từ `SELECTED_LIGHT` của HitTargetScene (không import thẳng từ scene được:
 * scene kéo theo Phaser, chỉ được tải lười khi vào vòng chơi). Hình hướng dẫn luôn vẽ thẻ giấy kem
 * trên nền bảng như artboard `HitTargetHowTo`, ở cả hai chủ đề.
 */
const SELECTED = "#cdeedb";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Thẻ số 76 × 76: bóng đổ mực, mặt giấy. Thẻ đã chọn lún xuống 3 px, viền đậm hơn. */
function Card(props: { x: number; y: number; value: number; on?: boolean }) {
  const { x, y, value, on } = props;
  const sink = on ? 3 : 0;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-38} y={-34} width={76} height={76} rx={14} className="fill-ink" />
      <rect
        x={-38}
        y={-38 + sink}
        width={76}
        height={76}
        rx={14}
        fill={on ? SELECTED : undefined}
        className={cn("stroke-ink", !on && "fill-paper")}
        strokeWidth={on ? 4 : 3}
      />
      <text
        y={14 + sink}
        textAnchor="middle"
        fontSize={40}
        className="fill-ink font-display font-extrabold"
      >
        {value}
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Chạm đích (màn Hướng dẫn, thẻ game), theo artboard `HitTargetHowTo`: hồng tâm ghi
 * 10 ở trên; hàng dưới có 4 thẻ 3, 5, 9, 7. Thẻ 3 đã chọn (lún xuống, khoanh phấn vàng), ngón tay
 * đang chạm thẻ 7 (có tia phấn). Hai mũi tên phấn nét đứt từ thẻ 3 và thẻ 7 lên hồng tâm, giữa có
 * dấu cộng. Đặt trên nền bảng (`bg-board`).
 */
export function HitTargetHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Mũi tên phấn nét đứt từ hai thẻ đáp án lên hồng tâm, dấu cộng ở giữa */}
      <g className={CHALK} strokeWidth={3} strokeLinecap="round" strokeDasharray="7 6">
        <path d="M112 216 C112 160 180 140 230 128" />
        <path d="M448 216 C448 160 380 140 330 128" />
      </g>
      <g className={CHALK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M218.8 123.6 L230 128 L222.1 137" />
        <path d="M341.2 123.6 L330 128 L337.9 137" />
        <path d="M266 178 L294 178 M280 164 L280 192" strokeWidth={4} />
      </g>

      {/* Hồng tâm */}
      <circle cx={280} cy={96} r={56} className="fill-ink" />
      <circle cx={280} cy={92} r={56} className="fill-compute stroke-ink" strokeWidth={3.5} />
      <path
        d="M280 39 L280 47 M280 137 L280 145 M227 92 L235 92 M325 92 L333 92"
        className="fill-none stroke-paper"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={280} cy={92} r={42} className="fill-paper stroke-ink" strokeWidth={3} />
      <text
        x={280}
        y={108}
        textAnchor="middle"
        fontSize={44}
        className="fill-ink font-display font-extrabold"
      >
        10
      </text>

      <Card x={224} y={268} value={5} />
      <Card x={336} y={268} value={9} />
      <Card x={112} y={268} value={3} on />
      <Card x={448} y={268} value={7} on />

      {/* Thẻ 3 đã chọn: khoanh phấn vàng. Thẻ 7 đang được chạm: tia phấn vàng */}
      <rect
        x={64}
        y={221}
        width={96}
        height={98}
        rx={20}
        className="fill-none stroke-primary filter-[url(#chalk)]"
        strokeWidth={3.5}
      />
      <path
        d="M400 272 L390 272 M496 272 L506 272 M404 228 L397 221 M492 228 L499 221 M404 318 L397 325"
        className="fill-none stroke-primary filter-[url(#chalk)]"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        transform="translate(466 292) scale(2.2) translate(-11 -3.5)"
        d="M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z"
        className="fill-board stroke-chalk filter-[url(#chalk)]"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
