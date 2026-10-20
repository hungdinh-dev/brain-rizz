import { cn } from "@/lib/utils";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = "filter-[url(#chalk)]";

/** Phấn vàng của game (cùng mã với scene; phấn trắng dùng token `chalk`). */
const YELLOW = "#f2b632";

/** Mũi tên chỉ LÊN, cùng hình với scene (đơn vị khung). */
const SOLID = "M0 56 L0 -54 M-30 -26 L0 -58 L30 -26";
const DOUBLE = "M-11 56 L-11 -24 M11 56 L11 -24 M0 -60 L32 -24 L-32 -24 Z";
const BUTTON_ARROW = "M0 15 L0 -15 M-11 -4 L0 -15 L11 -4";
const TICK = "M-12 1 L-3 10 L13 -9";
const GUIDE = "M0 0 L44 0 M34 -10 L44 0 L34 10";
const GUIDE_SMALL = "M0 0 L22 0 M15 -7 L22 0 L15 7";
/** Chấm bụi phấn sau mũi tên trượt LÊN (nằm phía dưới). */
const DUST = [
  [-8, 70, 4.5, 0.7],
  [9, 78, 3.6, 0.6],
  [-2, 90, 3.2, 0.5],
  [7, 101, 2.6, 0.4],
  [-7, 111, 2.2, 0.3],
  [3, 121, 1.8, 0.22],
] as const;

type Tone = "white" | "yellow";

/** Vệt bụi phấn phía sau mũi tên trượt LÊN; xoay để đổi hướng trượt. */
function Trail({ tone }: { tone: Tone }) {
  const color = tone === "white" ? undefined : YELLOW;
  const colorClass = tone === "white" ? "stroke-chalk fill-chalk" : undefined;
  return (
    <g className={colorClass} stroke={color} fill={color}>
      <path
        d="M0 68 L0 118"
        fill="none"
        strokeOpacity={0.18}
        strokeWidth={30}
        strokeLinecap="round"
      />
      {DUST.map(([cx, cy, r, opacity]) => (
        <circle key={cy} cx={cx} cy={cy} r={r} fillOpacity={opacity} stroke="none" />
      ))}
    </g>
  );
}

/** Mũi tên phấn chỉ lên: trắng nét liền, vàng nét đôi đầu rỗng. */
function Arrow({ tone }: { tone: Tone }) {
  const d = tone === "white" ? SOLID : DOUBLE;
  const width = tone === "white" ? 13 : 8;
  return (
    <g
      className={cn(CHALK, tone === "white" && "stroke-chalk")}
      stroke={tone === "white" ? undefined : YELLOW}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} strokeWidth={width + 8} strokeOpacity={0.15} />
      <path d={d} strokeWidth={width} />
    </g>
  );
}

/** Mũi tên phấn đang trượt sang PHẢI (vệt bụi bên trái), chỉ lên. */
function SlidingArrow({ x, y, tone }: { x: number; y: number; tone: Tone }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.5)`}>
      <g transform="rotate(90)">
        <Trail tone={tone} />
      </g>
      <Arrow tone={tone} />
    </g>
  );
}

/** Ô bảng phấn nhỏ (nền tối hơn mặt bảng, viền phấn). */
function Panel({ x }: { x: number }) {
  return (
    <>
      <rect x={x} y={22} width={246} height={182} rx={16} fill="#000000" fillOpacity={0.16} />
      <rect
        x={x}
        y={22}
        width={246}
        height={182}
        rx={16}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
    </>
  );
}

/** Nút hướng: sáng vàng + dấu ✓ (đúng) hoặc mờ, gạch chéo (sai). `rotate` = góc mũi tên. */
function DirButton({ x, rotate, right }: { x: number; rotate: number; right: boolean }) {
  if (right) {
    return (
      <g transform={`translate(${x} 236)`}>
        <rect x={-34} y={-25} width={68} height={56} rx={14} className="fill-ink" />
        <rect
          x={-34}
          y={-29}
          width={68}
          height={56}
          rx={14}
          strokeWidth={3.5}
          className="fill-primary stroke-ink"
        />
        <path
          d={BUTTON_ARROW}
          transform={`translate(0 -1) rotate(${rotate})`}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
        <g transform="translate(32 -28) scale(0.62)">
          <circle cy={5} r={26} className="fill-ink" />
          <circle r={26} strokeWidth={4} className="fill-primary stroke-ink" />
          <path
            d={TICK}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink"
          />
        </g>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} 236)`} opacity={0.55}>
      <rect
        x={-34}
        y={-29}
        width={68}
        height={56}
        rx={14}
        fill="none"
        strokeWidth={3.5}
        className={cn(CHALK, "stroke-chalk")}
      />
      <path
        d={BUTTON_ARROW}
        transform={`translate(0 -1) rotate(${rotate})`}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-chalk"
      />
      <path
        d="M-30 -24 L30 22"
        strokeWidth={5}
        strokeLinecap="round"
        className="stroke-destructive"
      />
    </g>
  );
}

/** Mũi tên chỉ dẫn vàng viền đậm (như lúc hiện đáp án trong scene). */
function Guide({ d, x, y, width }: { d: string; x: number; y: number; width: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} strokeWidth={width * 2} className="stroke-ink" />
      <path d={d} strokeWidth={width} className="stroke-primary" />
    </g>
  );
}

/**
 * Hình minh hoạ Phấn trượt (màn Hướng dẫn, thẻ game), theo bản mẫu ChalkArrowsHowTo: hai ô bảng
 * phấn. Ô trái: ba mũi tên phấn trắng nét liền chỉ lên, vệt bụi bên trái (đang trượt sang phải),
 * đầu mũi tên được khoanh; nút "lên" sáng + ✓, nút "phải" mờ gạch chéo. Ô phải: ba mũi tên phấn
 * vàng nét đôi chỉ lên, cũng trượt sang phải, mũi tên vàng theo hướng trượt; nút "phải" sáng + ✓,
 * nút "lên" mờ gạch chéo. Dưới mỗi ô: biểu tượng "mũi tên chỉ" và "vệt trượt". Đặt trên nền bảng.
 */
export function ChalkArrowsHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Ô trái: phấn trắng → theo mũi tên chỉ */}
      <Panel x={18} />
      <SlidingArrow x={95} y={100} tone="white" />
      <SlidingArrow x={171} y={76} tone="white" />
      <SlidingArrow x={159} y={158} tone="white" />
      <circle cx={171} cy={55} r={15} fill="none" strokeWidth={8} className="stroke-ink" />
      <circle cx={171} cy={55} r={15} fill="none" strokeWidth={4} className="stroke-primary" />
      <DirButton x={101} rotate={0} right />
      <DirButton x={181} rotate={90} right={false} />
      <g transform="translate(141 306) scale(0.3)">
        <Arrow tone="white" />
      </g>
      <circle cx={141} cy={293} r={10} fill="none" strokeWidth={3.5} className="stroke-primary" />

      {/* Ô phải: phấn vàng → theo hướng trượt */}
      <Panel x={296} />
      <SlidingArrow x={373} y={100} tone="yellow" />
      <SlidingArrow x={449} y={76} tone="yellow" />
      <SlidingArrow x={437} y={158} tone="yellow" />
      <Guide d={GUIDE} x={477} y={158} width={4.5} />
      <DirButton x={379} rotate={90} right />
      <DirButton x={459} rotate={0} right={false} />
      <g transform="translate(410 306) scale(0.3)">
        <g transform="rotate(90)">
          <Trail tone="yellow" />
        </g>
        <Arrow tone="yellow" />
      </g>
      <Guide d={GUIDE_SMALL} x={434} y={306} width={4.5} />
    </svg>
  );
}
