import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  IconBadge,
  Mark,
  popIn,
  RectRing,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { BoxCard, Card, FoldBoxHowTo, type MarkSymbol, Net } from "./FoldBoxHowTo";

type Point = readonly [x: number, y: number];
type NetMarks = [MarkSymbol, number, number][];

/** Thẻ khối mẫu của hình minh hoạ dời sang phải 40 để nằm giữa sân khấu (tâm 320, 74). */
const MODEL_DX = 40;
/** Hai thẻ lưới 130 × 130: tâm trái (đúng) và phải (sai). */
const GOOD: Point = [215, 265];
const BAD: Point = [425, 265];
/** Lưới đúng: vòng tròn, chấm, dấu cộng ở ba ô kề nhau (như hình minh hoạ). */
const GOOD_MARKS: NetMarks = [
  ["ring", -13, 0],
  ["dot", 13, 0],
  ["plus", -13, 26],
];
/** Lưới sai: chấm cách vòng tròn một ô, gấp lại thành hai mặt đối diện. */
const BAD_MARKS: NetMarks = [
  ["ring", -13, 0],
  ["dot", 39, 0],
  ["plus", -13, 26],
];

/**
 * Kịch bản Gấp hộp (CR-021, T = 4.800 ms): nhìn khối mẫu (chấm trên, vòng trái, cộng phải) → chạm
 * lưới có ba ký hiệu ở ba ô kề nhau → ✓; lưới còn lại khoanh chấm và vòng tròn (gấp thành hai mặt
 * đối diện, không thể cùng thấy như khối mẫu) → ✗ + icon mặt đối diện.
 */
export const FOLD_BOX_SCRIPT = defineScript({
  id: "fdb",
  T: 4800,
  steps: [0, 1000, 2300],
  hand: {
    moves: [
      [650, 500, GOOD],
      [1850, 400, null],
    ],
    taps: [1250],
  },
  tracks: {
    model: track().to(400, 200, { s: 1.05 }, "glide").to(600, 200, { s: 1 }, "glide"),
    good: track().bump(1310, 1.06, 180),
    ring: popIn(1310),
    ok: popIn(1370),
    rp: ripple(1250),
    // Bước ③: hai ô của lưới sai lần lượt được khoanh, rồi ✗ và icon mặt đối diện.
    c1: popIn(2400),
    c2: popIn(2520),
    bad: track({ o: 0 }).fade(2640, 120),
    x: popIn(2700),
    opp: popIn(2780),
  },
});

/** Thẻ lưới (giấy) + lưới chữ thập, vẽ quanh tâm 0,0. */
function NetCard({ marks }: { marks: NetMarks }) {
  return (
    <>
      <Card x={-65} y={-65} size={130} border={3} />
      <Net cx={0} cy={0} marks={marks} />
    </>
  );
}

/** Hình minh hoạ động Gấp hộp (màn Hướng dẫn); khung tĩnh = `FoldBoxHowTo`. */
export function FoldBoxDemo(props: DemoProps) {
  return (
    <DemoStage script={FOLD_BOX_SCRIPT} still={FoldBoxHowTo} {...props}>
      <A k="model" x={280 + MODEL_DX} y={74}>
        <g transform="translate(-280 -74)">
          <BoxCard />
        </g>
      </A>

      <A k="good" x={GOOD[0]} y={GOOD[1]}>
        <NetCard marks={GOOD_MARKS} />
      </A>
      <g transform={`translate(${BAD[0]} ${BAD[1]})`}>
        <NetCard marks={BAD_MARKS} />
      </g>

      <RectRing k="ring" x={GOOD[0]} y={GOOD[1]} w={148} h={148} rx={22} />
      <Mark k="ok" x={GOOD[0] + 68} y={GOOD[1] - 70} kind="ok" />
      <Ripple k="rp" x={GOOD[0]} y={GOOD[1]} />

      {/* Lưới sai: vòng tròn và chấm nằm ở hai mặt đối diện */}
      <Ring k="c1" x={BAD[0] - 13} y={BAD[1]} rx={17} />
      <Ring k="c2" x={BAD[0] + 39} y={BAD[1]} rx={17} />
      <A k="bad" x={BAD[0]} y={BAD[1]}>
        <rect
          x={-72}
          y={-72}
          width={144}
          height={144}
          rx={20}
          fill="none"
          className="stroke-destructive"
          strokeWidth={4.5}
          strokeDasharray="11 7"
        />
      </A>
      <Mark k="x" x={BAD[0] + 68} y={BAD[1] - 70} kind="bad" />
      {/* Icon mặt đối diện: ba ô, ô giữa nét đứt (như hình minh hoạ); đầu nét vuông cho nét đứt. */}
      <IconBadge k="opp" x={BAD[0] + 104} y={BAD[1]} r={22}>
        <g strokeWidth={2.4} strokeLinecap="butt">
          <rect x={-15} y={-4.5} width={9} height={9} className="fill-chalk" />
          <rect x={-4.5} y={-4.5} width={9} height={9} fill="none" strokeDasharray="2.5 2" />
          <rect x={6} y={-4.5} width={9} height={9} className="fill-chalk" />
        </g>
      </IconBadge>
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
