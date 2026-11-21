import { A, Cursor, DemoStage, defineScript, Mark, popIn, StepBadge, track } from "../_shared/demo";
import type { DemoProps } from "../types";
import { DROP, PourLineHowTo } from "./PourLineHowTo";

/** Nét phấn sần cho lớp tĩnh (filter #chalk khai báo trong <ChalkDefs /> của App). */
const CHALK = "fill-none stroke-chalk filter-[url(#chalk)]";

/** Ống đong thẳng: lòng ống x 232–348, đáy y 286; vạch ở y 150, dải vạch 134–166. */
const TUBE = { left: 232, right: 348, bottom: 286 } as const;
const MARK_Y = 150;
const BAND = 16;
/** Dòng nước rót từ miệng ống nghiệm (292, 52). */
const STREAM = { x: 287, y: 52, w: 10 } as const;
/** Nút giữ tròn lớn góc dưới phải. */
const BUTTON = [486, 282] as const;

/** Giữ từ `HOLD` tới `RELEASE`: nước dâng đều, buông đúng lúc mặt nước chạm vạch. */
const HOLD = 1000;
const RELEASE = 2700;

/**
 * Kịch bản Rót vừa vạch (CR-021, T = 4.800 ms): tay chạm giữ nút → nước chảy, mặt nước dâng đều →
 * tới vạch thì nhấc tay → dòng nước tắt, mặt nước nằm trong dải vạch → ✓.
 */
export const POUR_LINE_SCRIPT = defineScript({
  id: "pl",
  T: 4800,
  steps: [0, 2100, 2850],
  hand: {
    moves: [
      [400, 500, BUTTON],
      [3100, 400, null],
    ],
    taps: [],
    // Giữ (không phải chạm): nhấn xuống lúc HOLD, giữ nguyên tới RELEASE rồi bật lại.
    holds: [[HOLD, RELEASE]],
  },
  tracks: {
    glow: track({ o: 0 }).fade(HOLD, 100).fade(RELEASE, 120, 0),
    st: track({ sy: 0, o: 0 })
      .jump(HOLD, { o: 1 })
      .to(HOLD + 1, 150, { sy: 1 }, "linear")
      .fade(RELEASE, 120, 0, "linear"),
    lvl: track({ sy: 0 }).to(HOLD + 100, RELEASE - HOLD - 100, { sy: 1 }, "linear"),
    band: track().bump(RELEASE + 60, 1.08, 200),
    ok: popIn(RELEASE + 120),
  },
});

/** Ống nghiệm rót nghiêng 25°, miệng ở gốc toạ độ (như `PourLineHowTo`). */
function Faucet() {
  return (
    <g transform="rotate(25)">
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

/** Hình minh hoạ động Rót vừa vạch (màn Hướng dẫn); khung tĩnh = `PourLineHowTo`. */
export function PourLineDemo(props: DemoProps) {
  const level = TUBE.bottom - MARK_Y;
  const width = TUBE.right - TUBE.left;
  return (
    <DemoStage
      script={POUR_LINE_SCRIPT}
      still={PourLineHowTo}
      {...props}
      backdrop={
        <>
          {/* Ống đong: thân, môi loe, vạch chia, chân đế */}
          <path
            d={`M222 70 L230 78 L230 ${TUBE.bottom} L350 ${TUBE.bottom} L350 78 L358 70`}
            className={CHALK}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M233 102 L247 102 M233 126 L241 126 M233 198 L241 198 M233 222 L247 222 M233 246 L241 246 M233 270 L241 270"
            className={CHALK}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
          <rect
            x={206}
            y={TUBE.bottom}
            width={168}
            height={14}
            rx={6}
            className={CHALK}
            strokeWidth={4}
          />
          <g transform={`translate(${STREAM.x + STREAM.w / 2} ${STREAM.y})`}>
            <Faucet />
          </g>
          {/* Mũi tên tam giác chỉ vào vạch */}
          <path
            d={`M200 ${MARK_Y} L176 ${MARK_Y - 14} L176 ${MARK_Y + 14} Z`}
            strokeWidth={3}
            strokeLinejoin="round"
            className="fill-primary stroke-ink"
          />
        </>
      }
    >
      {/* Dòng nước: dài ra từ miệng ống nghiệm, tắt khi nhấc tay */}
      <A k="st" x={STREAM.x} y={STREAM.y}>
        <rect width={STREAM.w} height={TUBE.bottom - STREAM.y} rx={4} className="fill-sky" />
      </A>
      {/* Mặt nước dâng: phóng dọc từ đáy ống */}
      <A k="lvl" x={TUBE.left} y={TUBE.bottom}>
        <rect y={-level} width={width} height={level} className="fill-sky" />
      </A>
      {/* Dải vạch vàng mờ + vạch đứt nét (vẽ trên nước để luôn thấy) */}
      <A k="band" x={(TUBE.left + TUBE.right) / 2} y={MARK_Y}>
        <rect
          x={-width / 2}
          y={-BAND}
          width={width}
          height={BAND * 2}
          className="fill-primary"
          opacity={0.4}
        />
        <path
          d={`M${-width / 2 - 24} 0 L${width / 2 + 24} 0`}
          className="fill-none stroke-chalk"
          strokeWidth={4}
          strokeDasharray="10 7"
        />
      </A>
      <Mark k="ok" x={TUBE.right + 46} y={MARK_Y} kind="ok" />

      {/* Nút giữ: quầng vàng khi đang giữ */}
      <A k="glow" x={BUTTON[0]} y={BUTTON[1]}>
        <circle r={42} fill="none" className="stroke-primary" strokeWidth={5} opacity={0.7} />
      </A>
      <g transform={`translate(${BUTTON[0]} ${BUTTON[1]})`}>
        <circle cy={5} r={32} className="fill-ink" />
        <circle r={32} strokeWidth={3.5} className="fill-primary stroke-ink" />
        <path d={DROP} transform="translate(0 -1) scale(0.5)" className="fill-ink" />
      </g>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
