import { cn } from "@/lib/utils";

/**
 * Đĩa bia mồi, lấy từ `DECOY_FILL` của AimTrainerScene (không import thẳng từ scene được: scene kéo
 * theo Phaser, chỉ được tải lười khi vào vòng chơi). Bản mẫu dùng cùng một màu ở cả hai chủ đề.
 */
const DECOY_FILL = "#c93a55";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Viền răng cưa của bia mồi (28 đỉnh, nằm trong bán kính 40). */
const SAW =
  "M0 -39.6 L7.2 -31.6 L17.2 -35.7 L20.2 -25.3 L31 -24.7 L29.2 -14.1 L38.6 -8.8 L32.4 0 L38.6 8.8 L29.2 14.1 L31 24.7 L20.2 25.3 L17.2 35.7 L7.2 31.6 L0 39.6 L-7.2 31.6 L-17.2 35.7 L-20.2 25.3 L-31 24.7 L-29.2 14.1 L-38.6 8.8 L-32.4 0 L-38.6 -8.8 L-29.2 -14.1 L-31 -24.7 L-20.2 -25.3 L-17.2 -35.7 L-7.2 -31.6 Z";

/** Ngón tay chạm (khung 24 × 24). */
const HAND =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/** Bia hồng tâm bán kính `r`: bóng mực, ba vòng giấy / cam Nhận diện / vàng. */
function Bullseye(props: { x: number; y: number; r: number }) {
  const { x, y, r } = props;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cy={4} r={r} className="fill-ink" />
      <circle r={r} className="fill-paper stroke-ink" strokeWidth={3.5} />
      <circle r={r * 0.64} className="fill-identify stroke-ink" strokeWidth={3} />
      <circle r={r * 0.28} className="fill-sun stroke-ink" strokeWidth={3} />
    </g>
  );
}

/**
 * Hình minh hoạ Luyện ngắm (màn Hướng dẫn, thẻ game), theo artboard `AimTrainerHowTo`: khung phấn
 * chữ nhật đứng; ngón tay chạm giữa bia hồng tâm ở góc dưới trái, tia phấn vàng bung quanh; mũi tên
 * phấn nét đứt cong lên một bia mới nhỏ hơn ở góc trên phải. Bên trái là đồng hồ bấm giờ bằng phấn.
 * Góc dưới phải: bia mồi đỏ viền răng cưa có dấu X, bị khoanh gạch chéo (không bắn). Đặt trên nền
 * bảng (`bg-board`).
 */
export function AimTrainerHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Khung chơi */}
      <rect x={160} y={26} width={236} height={308} rx={14} className={CHALK} strokeWidth={4} />

      {/* Bia vừa bị chạm, tia phấn vàng bung quanh */}
      <Bullseye x={232} y={248} r={42} />
      <path
        d="M170 248 L182 248 M232 186 L232 198 M188 204 L196 212 M276 204 L268 212 M294 248 L282 248"
        className="fill-none stroke-sun filter-[url(#chalk)]"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d={HAND}
        transform="translate(252 270) scale(2.4) translate(-11 -3.5)"
        className="fill-board stroke-chalk filter-[url(#chalk)]"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Mũi tên nét đứt sang bia mới */}
      <g className={CHALK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M250 196 C262 140 290 112 312 100" strokeDasharray="8 7" />
        <path d="M299 96.5 L312 100 L305 112" />
      </g>
      <Bullseye x={342} y={88} r={30} />

      {/* Đồng hồ bấm giờ */}
      <g className={CHALK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={86} cy={150} r={34} />
        <path d="M86 116 L86 106 M76 102 L96 102 M86 150 L86 128 M86 150 L102 160" />
        <path d="M58 210 L114 210 M66 226 L106 226" strokeDasharray="6 7" />
      </g>

      {/* Bia mồi: đĩa đỏ viền răng cưa, dấu X; khoanh gạch chéo = không bắn */}
      <g transform="translate(470 254)">
        <path d={SAW} transform="translate(0 4)" className="fill-ink" />
        <path
          d={SAW}
          fill={DECOY_FILL}
          className="stroke-ink"
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        <path
          d="M-14 -14 L14 14 M14 -14 L-14 14"
          className="fill-none stroke-ink"
          strokeWidth={15}
          strokeLinecap="round"
        />
        <path
          d="M-14 -14 L14 14 M14 -14 L-14 14"
          className="fill-none stroke-paper"
          strokeWidth={9}
          strokeLinecap="round"
        />
      </g>
      <g className={CHALK} strokeLinecap="round" strokeWidth={7}>
        <circle cx={470} cy={254} r={56} />
        <path d="M430 294 L510 214" />
      </g>
      <g className="fill-none stroke-memorize" strokeLinecap="round" strokeWidth={3.5}>
        <circle cx={470} cy={254} r={56} />
        <path d="M430 294 L510 214" />
      </g>
    </svg>
  );
}
