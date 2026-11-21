import { CIRCUIT_E, CIRCUIT_N, CIRCUIT_S, CIRCUIT_W } from "@brain-rizz/shared";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  flyIn,
  LockPill,
  Mark,
  popIn,
  Question,
  questionIn,
  questionOut,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { Battery, CARD, Card, CircuitLinkHowTo, QUESTION } from "./CircuitLinkHowTo";

type Point = readonly [number, number];

/** Lưới 3 × 3 ô 68 (x 218–422, y 16–220), như hình tĩnh dời phải 40; ba thẻ dưới lưới. */
const CELL = 68;
const GRID = { x: 218, y: 16 } as const;
const GRID_RIGHT = GRID.x + 3 * CELL;
const center = (cell: number): Point => [
  GRID.x + ((cell % 3) + 0.5) * CELL,
  GRID.y + (Math.floor(cell / 3) + 0.5) * CELL,
];
const CARD_XS = [208, 320, 432] as const;
const CARD_Y = CARD.y + CARD.h / 2;
/** Nửa cạnh mảnh dây trên thẻ (ô 52) và trên lưới (ô 68). */
const CARD_HALF = 26;
const CELL_HALF = CELL / 2;

const STRAIGHT = CIRCUIT_E | CIRCUIT_W;
const DOWN_LEFT = CIRCUIT_S | CIRCUIT_W;
const UP_RIGHT = CIRCUIT_N | CIRCUIT_E;

/** Hướng từ tâm ô ra từng cổng. */
const PORTS: readonly (readonly [bit: number, dx: number, dy: number])[] = [
  [CIRCUIT_N, 0, -1],
  [CIRCUIT_E, 1, 0],
  [CIRCUIT_S, 0, 1],
  [CIRCUIT_W, -1, 0],
];

/** Đường của một mảnh dây (bitmask cổng) quanh tâm 0,0: mỗi cổng một nét từ tâm ra mép. */
function wire(mask: number, half: number): string {
  return PORTS.filter(([bit]) => mask & bit)
    .map(([, dx, dy]) => `M0 0 L${dx * half} ${dy * half}`)
    .join(" ");
}

interface Board {
  /** Ô đã có dây: [chỉ số ô, mảnh]. Pin luôn ở mép trái ô 0. */
  tiles: readonly (readonly [cell: number, mask: number])[];
  gap: number;
  /** Ô có bóng đèn ở mép phải. */
  bulb: number;
  cards: readonly number[];
}

/** Câu 1: hàng trên ─ ─ ?, đáp án dây thẳng (thẻ 3). */
const Q1: Board = {
  tiles: [
    [0, STRAIGHT],
    [1, STRAIGHT],
  ],
  gap: 2,
  bulb: 2,
  cards: [DOWN_LEFT, UP_RIGHT, STRAIGHT],
};
/** Câu 2: ─ ? / └ ─ tới đèn hàng giữa; đáp án ┐ (thẻ 2), chạm nhầm ─ (thẻ 1) thành dây cụt. */
const Q2: Board = {
  tiles: [
    [0, STRAIGHT],
    [4, UP_RIGHT],
    [5, STRAIGHT],
  ],
  gap: 1,
  bulb: 5,
  cards: [STRAIGHT, DOWN_LEFT, UP_RIGHT],
};
const RIGHT_1 = 2;
const WRONG_2 = 0;
const RIGHT_2 = 1;
const TAP_1 = 1750;
const TAP_2 = 3650;

/** Mảnh dây bay từ thẻ vào ô trống: thu từ cỡ thẻ, hiện ngay khi chạm, lướt 300 ms. */
function flyTo(cardX: number, gap: number, at: number) {
  const [gx, gy] = center(gap);
  return flyIn(at, { x: cardX - gx, y: CARD_Y - gy, s: CARD_HALF / CELL_HALF }, 300);
}

/**
 * Kịch bản Nối mạch (T = 6.200 ms): ô trống "?" nhịp + khoanh → chạm thẻ dây thẳng, mảnh bay vào ô,
 * dòng điện chạy, đèn sáng → ✓; câu 2 chạm nhầm dây thẳng: mảnh vào ô thành dây cụt, đèn không
 * sáng → ✗ + rung, khoanh thẻ đúng ┐, nhãn khoá rút 1,2 s.
 */
export const CIRCUIT_LINK_SCRIPT = defineScript({
  id: "circuit-link",
  T: 6200,
  steps: [0, 1200, 3000],
  hand: {
    moves: [
      [1200, 450, [CARD_XS[RIGHT_1], CARD_Y + 4]],
      [3200, 350, [CARD_XS[WRONG_2], CARD_Y + 4]],
      [4300, 400, null],
    ],
    taps: [TAP_1, TAP_2],
  },
  tracks: {
    gap1: track()
      .bump(400, 1.12, 240)
      .bump(800, 1.12, 240)
      .fade(TAP_1 + 300, 120, 0),
    hGap: popIn(450).fade(1150, 150, 0),
    c1: track().bump(TAP_1 + 60, 1.1, 160),
    fly1: flyTo(CARD_XS[RIGHT_1], Q1.gap, TAP_1 + 100),
    lit: track({ o: 0 }).fade(TAP_1 + 450, 200),
    bulb: track({ o: 0 }).fade(TAP_1 + 550, 120),
    glow: popIn(TAP_1 + 550, 300, 0.6),
    ok1: popIn(TAP_1 + 650),
    rp1: ripple(TAP_1),
    q1: questionOut(2800),
    q2: questionIn(3000),
    gap2: track().fade(TAP_2 + 300, 120, 0),
    c2: track().bump(TAP_2 + 60, 1.1, 160),
    fly2: flyTo(CARD_XS[WRONG_2], Q2.gap, TAP_2 + 100)
      .shake(TAP_2 + 420)
      .fade(TAP_2 + 800, 200, 0),
    x2: popIn(TAP_2 + 420),
    rp2: ripple(TAP_2),
    ring2: popIn(TAP_2 + 600),
    lk: popIn(TAP_2 + 450),
    lkb: track().to(TAP_2 + 550, 1200, { sx: 0 }, "linear"),
  },
});

/** Nét dây phấn trên lưới (nét trơn: dây đổi theo câu nên nằm ở lớp động). */
function Wire({ mask, className }: { mask: number; className?: string }) {
  const d = wire(mask, CELL_HALF);
  return (
    <g fill="none" strokeLinecap="round" className={className ?? "stroke-chalk"}>
      <path d={d} strokeWidth={18} strokeOpacity={0.15} />
      <path d={d} strokeWidth={10} />
    </g>
  );
}

/** Ô trống: viền nét đứt vàng + dấu "?". */
function Gap() {
  const inset = CELL_HALF - 5;
  return (
    <>
      <rect
        x={-inset}
        y={-inset}
        width={2 * inset}
        height={2 * inset}
        rx={10}
        fill="none"
        strokeWidth={3.5}
        strokeDasharray="9 7"
        strokeOpacity={0.85}
        className="stroke-primary"
      />
      <path
        d={QUESTION}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        className="stroke-primary"
      />
      <circle cy={16} r={3.4} className="fill-primary" />
    </>
  );
}

/** Bóng đèn tắt (nét phấn) ở mép phải ô `cell`; `lit` = lớp sáng chồng lên (làn `bulb`, `glow`). */
function Bulb({ cell, lit }: { cell: number; lit?: boolean }) {
  const y = center(cell)[1];
  return (
    <g transform={`translate(${GRID_RIGHT} ${y}) scale(0.9)`} strokeLinecap="round">
      {lit ? (
        <A k="glow" x={35}>
          <circle r={30} className="fill-primary" fillOpacity={0.22} />
          <path
            d="M6.5 -17.9 L8.2 -22.6 M15.6 -10.9 L19.7 -13.8 M19 0 L24 0 M15.6 10.9 L19.7 13.8 M6.5 17.9 L8.2 22.6"
            fill="none"
            strokeWidth={4}
            className="stroke-primary"
          />
        </A>
      ) : null}
      <path d="M0 0 L11 0" strokeWidth={14} strokeLinecap="butt" className="stroke-chalk" />
      <rect
        x={10}
        y={-11}
        width={12}
        height={22}
        rx={3}
        fill="none"
        strokeWidth={4}
        className="stroke-chalk"
      />
      <circle cx={35} r={15} strokeWidth={4} className="fill-board-shade stroke-chalk" />
      {lit ? (
        <A k="bulb">
          <circle cx={35} r={15} strokeWidth={4} className="fill-primary stroke-primary" />
          <path
            d="M23 -5 L31 -5 Q38 -5 38 0 Q38 5 31 5 L23 5"
            fill="none"
            strokeWidth={2.5}
            className="stroke-ink"
          />
        </A>
      ) : null}
    </g>
  );
}

/** Thẻ mảnh dây vẽ quanh tâm (để nảy / rung quanh tâm thẻ). */
function PieceCard({ k, x, mask }: { k?: string; x: number; mask: number }) {
  const card = (
    <g transform={`translate(${-x} ${-CARD_Y})`}>
      <Card x={x} piece={wire(mask, CARD_HALF)} />
    </g>
  );
  return k ? (
    <A k={k} x={x} y={CARD_Y}>
      {card}
    </A>
  ) : (
    <g transform={`translate(${x} ${CARD_Y})`}>{card}</g>
  );
}

/** Một câu: dây sẵn có, ô trống, bóng đèn, ba thẻ (thẻ được chạm có làn riêng). */
function BoardView({
  board,
  gapKey,
  tapped,
  tapKey,
  lit,
}: {
  board: Board;
  gapKey: string;
  tapped: number;
  tapKey: string;
  lit?: boolean;
}) {
  const [gx, gy] = center(board.gap);
  return (
    <>
      {board.tiles.map(([cell, mask]) => {
        const [x, y] = center(cell);
        return (
          <g key={cell} transform={`translate(${x} ${y})`}>
            <Wire mask={mask} />
          </g>
        );
      })}
      <A k={gapKey} x={gx} y={gy}>
        <Gap />
      </A>
      <Bulb cell={board.bulb} lit={lit} />
      {board.cards.map((mask, i) => (
        <PieceCard
          key={CARD_XS[i]}
          k={i === tapped ? tapKey : undefined}
          x={CARD_XS[i] ?? 0}
          mask={mask}
        />
      ))}
    </>
  );
}

/** Hình minh hoạ động Nối mạch (màn Hướng dẫn); khung tĩnh = `CircuitLinkHowTo`. */
export function CircuitLinkDemo(props: DemoProps) {
  const cells = Array.from({ length: 9 }, (_, i) => center(i));
  const [g1x, g1y] = center(Q1.gap);
  const [g2x, g2y] = center(Q2.gap);
  return (
    <DemoStage
      script={CIRCUIT_LINK_SCRIPT}
      still={CircuitLinkHowTo}
      {...props}
      backdrop={
        <>
          {/* Khung ô mờ + pin ở mép trái hàng trên (giống nhau ở cả hai câu) */}
          <g fill="none" className="stroke-chalk" strokeWidth={2} strokeOpacity={0.16}>
            {cells.map(([x, y]) => (
              <rect
                key={`${x},${y}`}
                x={x - CELL_HALF + 3}
                y={y - CELL_HALF + 3}
                width={CELL - 6}
                height={CELL - 6}
                rx={8}
              />
            ))}
          </g>
          <Battery x={GRID.x} y={center(0)[1]} />
        </>
      }
    >
      <Question k="q1">
        <BoardView board={Q1} gapKey="gap1" tapped={RIGHT_1} tapKey="c1" lit />
        {/* Dòng điện chạy dọc cả hàng khi đủ dây */}
        <A k="lit">
          <path
            d={`M${GRID.x} ${g1y} L${GRID_RIGHT} ${g1y}`}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            className="stroke-primary"
          />
        </A>
        <A k="fly1" x={g1x} y={g1y}>
          <Wire mask={STRAIGHT} />
        </A>
        <Mark k="ok1" x={GRID_RIGHT + 80} y={g1y} kind="ok" />
      </Question>
      <Question k="q2">
        <BoardView board={Q2} gapKey="gap2" tapped={WRONG_2} tapKey="c2" />
        <A k="fly2" x={g2x} y={g2y}>
          <Wire mask={STRAIGHT} />
        </A>
        <Mark k="x2" x={g2x + CELL_HALF} y={g2y - CELL_HALF + 14} kind="bad" />
        <Ring k="ring2" x={CARD_XS[RIGHT_2]} y={CARD_Y + 2} rx={60} ry={54} />
        <LockPill k="lk" kb="lkb" x={530} y={210} />
      </Question>
      <Ripple k="rp1" x={CARD_XS[RIGHT_1]} y={CARD_Y} />
      <Ripple k="rp2" x={CARD_XS[WRONG_2]} y={CARD_Y} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
