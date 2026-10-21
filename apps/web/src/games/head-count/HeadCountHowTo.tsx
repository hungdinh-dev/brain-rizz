import { cn } from "@/lib/utils";
import { HAND_PATH } from "../_shared/icons";
import { kidArt, teacherArt } from "./figures";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Ba khung trên nền bảng: góc trái của từng khung, đỉnh và cỡ. */
const PANEL_X = [10, 198, 386] as const;
const PANEL = { y: 16, w: 164, h: 300 } as const;

/** Khung bảng phấn nhỏ (nền tối hơn mặt bảng, viền phấn). */
function Panel({ x }: { x: number }) {
  return (
    <>
      <rect
        x={x}
        y={PANEL.y}
        width={PANEL.w}
        height={PANEL.h}
        rx={16}
        fill="#000000"
        fillOpacity={0.16}
      />
      <rect
        x={x}
        y={PANEL.y}
        width={PANEL.w}
        height={PANEL.h}
        rx={16}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
    </>
  );
}

/** Nét phấn (mũi tên, đầu mũi tên). */
function ChalkLine({ d, className }: { d: string; className?: string }) {
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(CHALK, "stroke-chalk", className)}
    />
  );
}

/** Bàn (gốc ở giữa mép trên mặt bàn), cỡ một nửa bàn trong scene. */
function Desk({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeWidth={2} className="stroke-ink">
      <rect x={-23} y={3.5} width={46} height={17} rx={3} className="fill-wood" />
      <rect x={-23} y={3.5} width={46} height={17} rx={3} className="fill-ink" opacity={0.18} />
      <rect x={-26} y={-3.5} width={52} height={7} rx={3} className="fill-wood" />
    </g>
  );
}

/** Tường trước che lớp (màu nhóm Tính toán), cửa mở (lòng tối, lá cửa hẹp) hoặc đóng. */
function Wall({ x, open }: { x: number; open: boolean }) {
  const door = { x: x + 60, y: 86, w: 44, h: 68 };
  return (
    <g>
      <rect
        x={x + 12}
        y={30}
        width={140}
        height={124}
        rx={12}
        strokeWidth={3}
        className="fill-compute stroke-ink"
      />
      <path
        d={`M${x + 12} 62 L${x + 152} 62 M${x + 12} 94 L${x + 152} 94 M${x + 12} 126 L${x + 152} 126`}
        strokeWidth={2}
        opacity={0.14}
        className="stroke-ink"
      />
      {open ? (
        <>
          <rect x={door.x} y={door.y} width={door.w} height={door.h} className="fill-ink" />
          <rect
            x={door.x}
            y={door.y}
            width={9}
            height={door.h}
            strokeWidth={2}
            className="fill-wood stroke-ink"
          />
        </>
      ) : (
        <>
          <rect
            x={door.x}
            y={door.y}
            width={door.w}
            height={door.h}
            strokeWidth={2}
            className="fill-wood stroke-ink"
          />
          <circle
            cx={door.x + door.w - 8}
            cy={door.y + 36}
            r={3.5}
            strokeWidth={1.5}
            className="fill-primary stroke-ink"
          />
        </>
      )}
      <path
        d={`M${door.x} ${door.y + door.h} L${door.x} ${door.y} L${door.x + door.w} ${door.y} L${door.x + door.w} ${door.y + door.h}`}
        fill="none"
        strokeWidth={4}
        className="stroke-wood"
      />
    </g>
  );
}

/** Thẻ số nhỏ (giấy viền mực, bóng đổ). */
function NumberCard({ x, n }: { x: number; n: number }) {
  return (
    <g>
      <rect x={x} y={199} width={30} height={40} rx={7} className="fill-ink" />
      <rect
        x={x}
        y={196}
        width={30}
        height={40}
        rx={7}
        strokeWidth={2.5}
        className="fill-card stroke-ink"
      />
      <text
        x={x + 15}
        y={226}
        textAnchor="middle"
        fontSize={26}
        className="fill-card-foreground font-display font-extrabold"
      >
        {n}
      </text>
    </g>
  );
}

/**
 * Hình minh hoạ Đếm sĩ số (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: ba
 * khung nối bằng mũi tên phấn. Trái: lớp mở, 3 bạn ngồi ở bàn, bảng ghi "3". Giữa: tường che lớp,
 * cửa mở; bên trái 2 bạn quay lưng đi vào cửa ("+2"), bên phải 1 bạn quay mặt đi ra ("−1"). Phải:
 * cửa đóng, hàng thẻ 2 3 4 5, thẻ 4 khoanh phấn vàng, bàn tay chỉ vào. Góc dưới: thầy giáo (cao,
 * kính, ôm sách) bị gạch, nhắc luật Siêu khó. Đặt trên nền bảng.
 */
export function HeadCountHowTo({ className }: { className?: string }) {
  const [left, middle, right] = PANEL_X;
  return (
    <svg viewBox="6 10 556 346" aria-hidden className={cn("overflow-visible", className)}>
      {PANEL_X.map((x) => (
        <Panel key={x} x={x} />
      ))}
      <ChalkLine d="M179 166 L193 166 M187 159 L194 166 L187 173" />
      <ChalkLine d="M367 166 L381 166 M375 159 L382 166 L375 173" />

      {/* Trái: lớp mở, 3 bạn, bảng ghi 3 */}
      <rect
        x={left + 12}
        y={30}
        width={140}
        height={272}
        rx={12}
        strokeWidth={3}
        className="fill-card stroke-ink"
      />
      <rect
        x={left + 42}
        y={46}
        width={80}
        height={54}
        rx={6}
        strokeWidth={5}
        className="fill-board stroke-wood"
      />
      <text
        x={left + 82}
        y={88}
        textAnchor="middle"
        fontSize={42}
        className="fill-chalk font-display font-extrabold"
      >
        3
      </text>
      {(
        [
          [left + 50, 174, 0],
          [left + 114, 174, 3],
          [left + 82, 256, 1],
        ] as const
      ).map(([x, y, look]) => (
        <g key={`${x}-${y}`}>
          <g transform={`translate(${x} ${y + 18}) scale(0.5)`}>{kidArt(look, "front")}</g>
          <Desk x={x} y={y} />
        </g>
      ))}

      {/* Giữa: tường che lớp, cửa mở; 2 bạn vào (+2), 1 bạn ra (−1) */}
      <Wall x={middle} open />
      <g transform={`translate(${middle + 30} 206) scale(0.42)`}>{kidArt(4, "back")}</g>
      <g transform={`translate(${middle + 52} 218) scale(0.42)`}>{kidArt(2, "back")}</g>
      <g transform={`translate(${middle + 130} 218) scale(0.42)`}>{kidArt(5, "front")}</g>
      <ChalkLine
        d={`M${middle + 16} 238 L${middle + 62} 238 Q${middle + 79} 238 ${middle + 80} 172`}
      />
      <ChalkLine d={`M${middle + 72} 182 L${middle + 80} 170 L${middle + 88} 182`} />
      <ChalkLine
        d={`M${middle + 88} 172 Q${middle + 90} 238 ${middle + 108} 238 L${middle + 146} 238`}
      />
      <ChalkLine d={`M${middle + 137} 230 L${middle + 148} 238 L${middle + 137} 246`} />
      <text
        x={middle + 40}
        y={288}
        textAnchor="middle"
        fontSize={32}
        className="fill-chalk font-display font-extrabold"
      >
        +2
      </text>
      <text
        x={middle + 126}
        y={288}
        textAnchor="middle"
        fontSize={32}
        className="fill-chalk font-display font-extrabold"
      >
        −1
      </text>

      {/* Phải: cửa đóng, thẻ 2 3 4 5, thẻ 4 được khoanh và chỉ vào */}
      <Wall x={right} open={false} />
      {[2, 3, 4, 5].map((n, i) => (
        <NumberCard key={n} x={right + 14.5 + i * 35} n={n} />
      ))}
      <ellipse
        cx={right + 99.5}
        cy={217}
        rx={23}
        ry={29}
        fill="none"
        strokeWidth={4.5}
        className={cn(CHALK, "stroke-primary")}
      />
      <g transform={`translate(${right + 80} 242) scale(1.7)`}>
        <path
          d={HAND_PATH}
          strokeWidth={1.4}
          strokeLinejoin="round"
          className="fill-paper stroke-ink"
        />
      </g>

      {/* Góc dưới: thầy giáo không tính */}
      <circle cx={532} cy={322} r={28} strokeWidth={3} className="fill-card stroke-ink" />
      <g transform="translate(532 345) scale(0.25)">{teacherArt("front")}</g>
      <path
        d="M513 303 L551 341"
        strokeWidth={5.5}
        strokeLinecap="round"
        className="stroke-destructive"
      />
    </svg>
  );
}
