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
import { Buddy, RuleGateHowTo, ticketD } from "./RuleGateHowTo";
import { ARROW_LEFT, HAT } from "./shapes";

/** Nét phấn sần (filter #chalk), chỉ dùng ở lớp tĩnh. */
const CHALK = "filter-[url(#chalk)]";

/** Bố cục như hình tĩnh dời phải 40: cổng lớp bên trái (tâm x 132), nhà bên phải (tâm x 514). */
const GATE_X = 132;
const HOUSE_X = 514;
const GROUND_Y = 318;
/** Vé luật giữa phía trên. */
const TICKET = { x: 340, y: 64 } as const;
/** Chỗ bạn đứng trước cổng (neo giữa thân), thu 0,62: chân chạm gần mặt đất. */
const STAND = { x: 330, y: 258 } as const;
const BUDDY_SCALE = 0.62;
/** Điểm đặt ngón tay lên bạn để vuốt (giữa thân). */
const GRAB = [STAND.x, STAND.y - 8] as const;
/** Mũ trên đầu bạn (tâm chóp mũ trong toạ độ sân khấu), để khoanh khi khớp vé. */
const HAT_AT = [STAND.x + 6, STAND.y + (34 - 110) * BUDDY_SCALE] as const;

/** Hai lượt vuốt: ấn → kéo → nhả. Bạn trượt theo hướng vuốt rồi vào cổng / về nhà. */
const SWIPE_L = { press: 1850, drag: 1950, release: 2250 } as const;
const SWIPE_R = { press: 3700, drag: 3800, release: 4100 } as const;
const DRAG = 130;

/** Bạn đi tới cổng (trượt lên + hiện), bị vuốt về đích `dx` rồi khuất dần. */
const walker = (enter: number, drag: number, dx: number) =>
  track({ y: 36, o: 0 })
    .to(enter, 320, { y: 0, o: 1 })
    .to(drag, 380, { x: dx, s: 0.8 }, "glide")
    .fade(drag + 380, 160, 0);

/**
 * Kịch bản Cổng luật (T = 6.000 ms): vé vẽ mũ lưỡi trai được khoanh → bạn thỏ đội mũ tới, mũ khớp
 * vé → vuốt trái, thỏ vào cổng → ✓; bạn mèo không mũ tới → vuốt phải, mèo về nhà → ✓.
 */
export const RULE_GATE_SCRIPT = defineScript({
  id: "rule-gate",
  T: 6000,
  steps: [0, 1400, 3200],
  hand: {
    moves: [
      [1400, 400, GRAB],
      [SWIPE_L.drag, SWIPE_L.release - SWIPE_L.drag, [GRAB[0] - DRAG, GRAB[1]]],
      [3300, 350, GRAB],
      [SWIPE_R.drag, SWIPE_R.release - SWIPE_R.drag, [GRAB[0] + DRAG, GRAB[1]]],
      [4400, 400, null],
    ],
    taps: [],
    // Ấn giữ suốt lúc kéo (vuốt), không phải chạm.
    holds: [
      [SWIPE_L.press, SWIPE_L.release],
      [SWIPE_R.press, SWIPE_R.release],
    ],
  },
  tracks: {
    hT: popIn(400).fade(1400, 150, 0),
    hHat: popIn(950).fade(1700, 150, 0),
    bunny: walker(500, SWIPE_L.drag, GATE_X - STAND.x),
    cat: walker(3200, SWIPE_R.drag, HOUSE_X - STAND.x),
    rp1: ripple(SWIPE_L.press),
    rp2: ripple(SWIPE_R.press),
    arL: popIn(SWIPE_L.drag).fade(SWIPE_L.release + 250, 150, 0),
    arR: popIn(SWIPE_R.drag).fade(SWIPE_R.release + 250, 150, 0),
    ok1: popIn(2450).fade(3100, 150, 0),
    ok2: popIn(4300),
  },
});

/** Lớp tĩnh: vé luật (mũ lưỡi trai), mặt đất, cổng lớp mở, ngôi nhà (như hình tĩnh). */
function Backdrop() {
  return (
    <>
      <g transform={`translate(${TICKET.x} ${TICKET.y})`}>
        <path
          d={ticketD(150, 84)}
          strokeWidth={4}
          className={`${CHALK} stroke-chalk fill-chalk`}
          fillOpacity={0.08}
        />
        <g transform="scale(0.5) translate(-122 -38)" className={`${CHALK} stroke-chalk`}>
          <path
            d={HAT.brim}
            strokeWidth={10}
            strokeLinejoin="round"
            className="fill-chalk"
            fillOpacity={0.5}
          />
          <path
            d={HAT.crown}
            strokeWidth={10}
            strokeLinejoin="round"
            className="fill-chalk"
            fillOpacity={0.14}
          />
          <circle cx={HAT.button.cx} cy={HAT.button.cy} r={6} className="fill-chalk" />
        </g>
      </g>

      <path
        d={`M66 ${GROUND_Y} L574 ${GROUND_Y}`}
        strokeWidth={3}
        strokeOpacity={0.35}
        className="chalk-stroke stroke-chalk"
      />

      {/* Cổng lớp (mở) */}
      <g strokeLinejoin="round" className={`${CHALK} stroke-chalk`} strokeWidth={3.5}>
        <rect
          x={96}
          y={146}
          width={72}
          height={172}
          fill="#000000"
          fillOpacity={0.18}
          stroke="none"
        />
        <path d="M96 150 L112 157 L112 312 L96 318 Z" className="fill-wood" />
        <path d="M168 150 L152 157 L152 312 L168 318 Z" className="fill-wood" />
        <rect x={80} y={140} width={16} height={178} rx={4} className="fill-wood" />
        <rect x={168} y={140} width={16} height={178} rx={4} className="fill-wood" />
        <rect x={72} y={124} width={120} height={20} rx={6} className="fill-wood" />
        <rect x={114} y={100} width={36} height={30} rx={4} className="fill-card" />
        <path
          d="M122 110 L144 110 M122 118 L144 118"
          strokeWidth={2.5}
          className="stroke-analyze"
        />
      </g>

      {/* Nhà */}
      <g strokeLinejoin="round" strokeWidth={3.5} className={`${CHALK} stroke-chalk`}>
        <rect x={466} y={210} width={96} height={108} rx={4} className="fill-card" />
        <path d="M454 214 L514 150 L574 214 Z" className="fill-wood" />
        <path d="M502 318 V282 C502 270 526 270 526 282 V318 Z" className="fill-wood" />
        <rect x={476} y={226} width={18} height={18} rx={3} fill="none" />
      </g>
    </>
  );
}

/** Mũi tên vuốt (nét trơn, lớp động), `flip` = chỉ sang phải. */
function SwipeArrow({ k, x, flip }: { k: string; x: number; flip?: boolean }) {
  return (
    <A k={k} x={x} y={160}>
      <path
        d={ARROW_LEFT}
        transform={flip ? "scale(-0.9 0.9)" : "scale(0.9)"}
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-chalk"
      />
    </A>
  );
}

/** Hình minh hoạ động Cổng luật (màn Hướng dẫn); khung tĩnh = `RuleGateHowTo`. */
export function RuleGateDemo(props: DemoProps) {
  return (
    <DemoStage script={RULE_GATE_SCRIPT} still={RuleGateHowTo} {...props} backdrop={<Backdrop />}>
      <Ring k="hT" x={TICKET.x} y={TICKET.y} rx={92} ry={56} />
      <A k="bunny" x={STAND.x} y={STAND.y}>
        <Buddy species="bunny" hat x={0} y={0} scale={BUDDY_SCALE} />
      </A>
      <A k="cat" x={STAND.x} y={STAND.y}>
        <Buddy species="cat" hat={false} x={0} y={0} scale={BUDDY_SCALE} />
      </A>
      <Ring k="hHat" x={HAT_AT[0]} y={HAT_AT[1]} rx={44} ry={30} />
      <SwipeArrow k="arL" x={STAND.x - 40} />
      <SwipeArrow k="arR" x={STAND.x + 40} flip />
      <Mark k="ok1" x={GATE_X + 60} y={104} kind="ok" />
      <Mark k="ok2" x={HOUSE_X} y={120} kind="ok" />
      <Ripple k="rp1" x={GRAB[0]} y={GRAB[1]} />
      <Ripple k="rp2" x={GRAB[0]} y={GRAB[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
