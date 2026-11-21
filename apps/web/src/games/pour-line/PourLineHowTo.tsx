import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Ngón tay chỉ xuống, đầu ngón ở gốc toạ độ; móng tay gần đầu ngón. */
const FINGER = "M-13 -64 L-13 -13 A13 13 0 0 0 13 -13 L13 -64";
const NAIL = "M-7 -16 A7 7 0 0 0 7 -16";

/** Giọt nước trên nút giữ (tâm 0,0), cùng hình với scene. */
export const DROP =
  "M0 -36 C12 -20 26 -6 26 10 C26 26 14 36 0 36 C-14 36 -26 26 -26 10 C-26 -6 -12 -20 0 -36 Z";

const TICK = "M-12 1 L-3 10 L13 -9";

/** Ống nghiệm rót nghiêng 25°, miệng ở gốc toạ độ, nước đọng về phía miệng. */
function Faucet() {
  return (
    <g transform="translate(250 58) rotate(25)">
      <path d="M0 -14 L-70 -14 A14 14 0 0 0 -70 14 L0 14" className="fill-board" />
      <path d="M0 -14 L-34 -14 L-34 14 L0 14 Z" className="fill-sky" opacity={0.9} />
      <path
        d="M0 -14 L-70 -14 A14 14 0 0 0 -70 14 L0 14 M0 -14 L5 -19 M0 14 L5 19"
        className={CHALK}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * Hình minh hoạ Rót vừa vạch (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: ống
 * đong nét phấn, ống nghiệm phía trên đang rót một dòng nước xanh xuống. Ngang thân ống là dải vạch
 * vàng mờ (cùng màu dải vạch trong scene), giữa dải là vạch đứt nét, mép trái có mũi tên tam giác chỉ
 * vào vạch. Mặt nước vừa chạm giữa dải, dấu ✓ nhỏ bên phải. Góc dưới: ngón tay nhấc lên khỏi nút
 * tròn lớn, mũi tên cong "nhấc lên". Đặt trên nền bảng (`bg-board`).
 */
export function PourLineHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      <g transform="translate(-30 0)">
        {/* Dòng nước từ ống nghiệm xuống mặt nước */}
        <rect x={245} y={60} width={10} height={92} rx={4} className="fill-sky" />
        <Faucet />

        {/* Nước trong ống đong, dải vạch, mặt nước chạm giữa dải */}
        <rect x={196} y={150} width={108} height={112} className="fill-sky" opacity={0.9} />
        <rect x={196} y={134} width={108} height={32} className="fill-primary" opacity={0.4} />
        <path d="M196 150 L304 150" className="stroke-analyze" strokeWidth={5} />

        {/* Ống đong: thân, môi loe, vạch chia, chân đế */}
        <path
          d="M188 70 L196 78 L196 262 L304 262 L304 78 L312 70"
          className={CHALK}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M199 102 L213 102 M199 126 L207 126 M199 198 L207 198 M199 222 L213 222 M199 246 L207 246"
          className={CHALK}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.7}
        />
        <rect x={168} y={262} width={164} height={14} rx={6} className={CHALK} strokeWidth={4} />

        {/* Vạch đứt nét dài hơn ống + mũi tên tam giác chỉ vào vạch. Đường nằm ngang có khung bao
            cao 0 nên không gắn filter phấn (filter theo khung bao sẽ làm đường biến mất). */}
        <path
          d="M172 150 L328 150"
          className="fill-none stroke-chalk"
          strokeWidth={4}
          strokeDasharray="10 7"
        />
        <path
          d="M166 150 L142 136 L142 164 Z"
          strokeWidth={3}
          strokeLinejoin="round"
          className="fill-primary stroke-ink"
        />

        {/* Dấu ✓ cạnh mặt nước */}
        <g transform="translate(352 150)">
          <circle cy={3} r={17} className="fill-ink" />
          <circle r={17} strokeWidth={3} className="fill-primary stroke-ink" />
          <path
            d={TICK}
            transform="scale(0.7)"
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink"
          />
        </g>

        {/* Ngón tay nhấc lên khỏi nút tròn lớn */}
        <g transform="translate(440 304)">
          <circle cy={5} r={32} className="fill-ink" />
          <circle r={32} strokeWidth={3.5} className="fill-primary stroke-ink" />
          <path d={DROP} transform="translate(0 -1) scale(0.5)" className="fill-ink" />
        </g>
        {/* Ngón tay từ trên xuống, đầu ngón cách mặt nút một khoảng (vừa nhấc lên). */}
        <g transform="translate(440 252)">
          <path
            d={FINGER}
            className="fill-board stroke-chalk filter-[url(#chalk)]"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d={NAIL} className="fill-none stroke-chalk" strokeWidth={3} strokeLinecap="round" />
        </g>
        <path
          d="M422 262 L458 262"
          className="fill-none stroke-chalk"
          strokeWidth={3}
          strokeDasharray="5 6"
          strokeLinecap="round"
        />
        <g className={CHALK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M490 300 C506 278 506 246 490 222" />
          <path d="M481 231 L490 222 L497 234" />
        </g>
      </g>
    </svg>
  );
}
