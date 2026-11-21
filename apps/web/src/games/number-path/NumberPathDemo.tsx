import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { Cell, Exit, NumberPathHowTo } from "./NumberPathHowTo";

/** Như hình tĩnh dời phải 30: vòng xuất phát 5 ở (310, 52), hai đường xuống hai cửa ra y 280. */
const START = [310, 52] as const;
const LEFT_X = 226;
const RIGHT_X = 394;
const ROW_1 = 128;
const ROW_2 = 206;
const EXIT_Y = 280;
/** Số trung gian viết cạnh đường, ngay dưới mỗi ô phép. */
const MID_1 = 176;
const MID_2 = 251;
/** Thẻ đích 13 ở góc trên phải (ngoài vùng nút Phóng to). */
const TARGET = { x: 410, y: 24, w: 128, h: 58 } as const;
const TAP = 3550;

/**
 * Kịch bản Đường số (T = 5.600 ms): khoanh số xuất phát 5 rồi số đích 13 → tính đường trái
 * 5 ×2 = 10, +3 = 13; đường phải 5 +4 = 9, ×2 = 18 (gạch) → chạm cửa ra ○ của đường trái → ✓,
 * đường phải mờ đi.
 */
export const NUMBER_PATH_SCRIPT = defineScript({
  id: "number-path",
  T: 5600,
  steps: [0, 1300, 3000],
  hand: {
    moves: [
      [3000, 450, [LEFT_X, EXIT_Y + 2]],
      [4100, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    start: track().bump(400, 1.12, 240),
    hS: popIn(400).fade(1250, 150, 0),
    goal: track().bump(800, 1.1, 240),
    hG: popIn(800).fade(1250, 150, 0),
    l1: track().bump(1400, 1.12, 200),
    n10: popIn(1500),
    l2: track().bump(1800, 1.12, 200),
    n13: popIn(1900).bump(2200, 1.25, 240),
    r1: track().bump(2200, 1.12, 200),
    n9: popIn(2300),
    r2: track().bump(2600, 1.12, 200),
    n18: popIn(2700),
    cut: popIn(2850),
    dimR: track().fade(TAP + 100, 200, 0.4),
    exit: track().bump(TAP + 60, 1.18, 180),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
  },
});

/** Ô phép quanh tâm (để nảy quanh tâm ô). */
function OpCell({ k, x, y, label }: { k: string; x: number; y: number; label: string }) {
  return (
    <A k={k} x={x} y={y}>
      <Cell x={0} y={0} label={label} />
    </A>
  );
}

/** Số trung gian viết phấn (nét trơn, lớp động), canh theo `anchor`. */
function MidNumber(props: {
  k: string;
  x: number;
  y: number;
  value: number;
  anchor: "start" | "end";
}) {
  const { k, x, y, value, anchor } = props;
  return (
    <A k={k} x={x} y={y}>
      <text
        y={9}
        textAnchor={anchor}
        fontSize={26}
        className="fill-chalk font-display font-extrabold"
      >
        {value}
      </text>
    </A>
  );
}

/** Hình minh hoạ động Đường số (màn Hướng dẫn); khung tĩnh = `NumberPathHowTo`. */
export function NumberPathDemo(props: DemoProps) {
  return (
    <DemoStage
      script={NUMBER_PATH_SCRIPT}
      still={NumberPathHowTo}
      {...props}
      backdrop={
        // Đường trái (nét liền vàng) không đổi suốt vòng lặp nên vẽ phấn ở lớp tĩnh.
        <path
          d={`M${START[0]} ${START[1]} L${LEFT_X} ${ROW_1} L${LEFT_X} ${EXIT_Y}`}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-sun filter-[url(#chalk)]"
        />
      }
    >
      {/* Đường phải: nét gạch hồng, mờ đi sau khi chọn đường trái */}
      <A k="dimR">
        <path
          d={`M${START[0]} ${START[1]} L${RIGHT_X} ${ROW_1} L${RIGHT_X} ${EXIT_Y}`}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="16 11"
          className="stroke-pink"
        />
        <OpCell k="r1" x={RIGHT_X} y={ROW_1} label="+4" />
        <OpCell k="r2" x={RIGHT_X} y={ROW_2} label="×2" />
        <g transform={`translate(${RIGHT_X - 280} 0)`}>
          <Exit x={280}>
            <path
              d="M0 -13 L14 10 L-14 10 Z"
              fill="none"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeDasharray="8 5"
              className="stroke-pink"
            />
          </Exit>
        </g>
        <MidNumber k="n9" x={RIGHT_X + 18} y={MID_1} value={9} anchor="start" />
        <MidNumber k="n18" x={RIGHT_X + 18} y={MID_2} value={18} anchor="start" />
        <A k="cut" x={RIGHT_X + 36} y={MID_2}>
          <path
            d="M-24 12 L24 -12"
            strokeWidth={4.5}
            strokeLinecap="round"
            className="stroke-destructive"
          />
        </A>
      </A>

      {/* Đường trái (đúng): ô phép, số trung gian, cửa ra ○ */}
      <OpCell k="l1" x={LEFT_X} y={ROW_1} label="×2" />
      <OpCell k="l2" x={LEFT_X} y={ROW_2} label="+3" />
      <MidNumber k="n10" x={LEFT_X - 18} y={MID_1} value={10} anchor="end" />
      <MidNumber k="n13" x={LEFT_X - 18} y={MID_2} value={13} anchor="end" />
      <A k="exit" x={LEFT_X} y={EXIT_Y}>
        <g transform="translate(-280 -280)">
          <Exit x={280}>
            <circle r={12} fill="none" strokeWidth={4.5} className="stroke-sun" />
          </Exit>
        </g>
      </A>
      <Mark k="ok" x={LEFT_X - 44} y={EXIT_Y + 22} kind="ok" />

      {/* Vòng xuất phát 5 */}
      <A k="start" x={START[0]} y={START[1]}>
        <circle cy={4} r={30} className="fill-ink" />
        <circle r={30} strokeWidth={3} className="fill-paper stroke-ink" />
        <text
          y={12}
          textAnchor="middle"
          fontSize={34}
          className="fill-ink font-display font-extrabold"
        >
          5
        </text>
      </A>
      <Ring k="hS" x={START[0]} y={START[1]} rx={44} />

      {/* Thẻ đích 13: nền mực chữ vàng, hồng tâm nhỏ bên trái */}
      <A k="goal" x={TARGET.x + TARGET.w / 2} y={TARGET.y + TARGET.h / 2}>
        <g transform={`translate(${-TARGET.w / 2} ${-TARGET.h / 2})`}>
          <rect y={4} width={TARGET.w} height={TARGET.h} rx={14} className="fill-ink" />
          <rect
            width={TARGET.w}
            height={TARGET.h}
            rx={14}
            strokeWidth={2}
            className="fill-ink stroke-ink dark:stroke-chalk"
          />
          <circle cx={28} cy={29} r={15} strokeWidth={2.5} className="fill-compute stroke-ink" />
          <circle cx={28} cy={29} r={8} className="fill-paper" />
          <circle cx={28} cy={29} r={3} className="fill-ink" />
          <text
            x={82}
            y={43}
            textAnchor="middle"
            fontSize={38}
            className="fill-primary font-display font-extrabold"
          >
            13
          </text>
        </g>
      </A>
      <Ring k="hG" x={TARGET.x + TARGET.w / 2} y={TARGET.y + TARGET.h / 2 + 2} rx={72} ry={40} />

      <Ripple k="rp" x={LEFT_X} y={EXIT_Y} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
