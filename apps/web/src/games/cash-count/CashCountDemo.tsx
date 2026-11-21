import {
  A,
  Cursor,
  DemoStage,
  defineScript,
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
import { BILL_5K, BILL_10K, BILL_20K, Bill, Card, CashCountHowTo } from "./CashCountHowTo";

type Point = readonly [number, number];

/** Tờ 2.000 (màu giấy theo bảng `BILLS` của scene). */
const BILL_2K = { width: 236, fill: "#dcc19c", label: "2.000" };

/** Ba chỗ tờ tiền xếp dọc (tâm, độ nghiêng), như hình tĩnh dời sang phải 40. */
const BILL_AT: readonly (readonly [x: number, y: number, angle: number])[] = [
  [190, 84, -4],
  [198, 172, 3],
  [188, 260, -2],
];
/** Tâm bốn thẻ đáp án 100 × 52, lưới 2 × 2 đọc theo hàng. */
const CARD_AT: readonly Point[] = [
  [412, 132],
  [526, 132],
  [412, 206],
  [526, 206],
];
/** Câu 1: 20.000 + 10.000 + 5.000 = 35.000 (thẻ 3). Câu 2: 10.000 + 5.000 + 2.000 = 17.000 (thẻ 4). */
const Q1 = {
  bills: [BILL_20K, BILL_10K, BILL_5K],
  cards: ["25.000", "30.000", "35.000", "40.000"],
};
const Q2 = { bills: [BILL_10K, BILL_5K, BILL_2K], cards: ["7.000", "12.000", "15.000", "17.000"] };
const RIGHT_1 = CARD_AT[2] as Point;
/** Câu 2 chạm nhầm 12.000 (quên tờ 5.000), thẻ đúng 17.000. */
const WRONG_2 = CARD_AT[1] as Point;
const RIGHT_2 = CARD_AT[3] as Point;
const TAP_1 = 2250;
const TAP_2 = 3900;

/** Tờ tiền được đặt xuống bàn: trượt từ trái vào + hiện (220 ms). */
const deal = (at: number) => track({ x: -36, o: 0 }).to(at, 220, { x: 0, o: 1 });

/**
 * Kịch bản Đếm tiền nhanh (T = 6.200 ms): ba tờ lần lượt đặt xuống, nhịp đếm từng tờ → chạm thẻ
 * 35.000 → ✓; câu 2 chạm nhầm 12.000 → ✗ + rung, khoanh thẻ đúng 17.000, nhãn khoá rút 1,2 s.
 */
export const CASH_COUNT_SCRIPT = defineScript({
  id: "cash-count",
  T: 6200,
  steps: [0, 1700, 3000],
  hand: {
    moves: [
      [1700, 450, [RIGHT_1[0], RIGHT_1[1] + 4]],
      [3500, 300, [WRONG_2[0], WRONG_2[1] + 4]],
      [4300, 400, null],
    ],
    taps: [TAP_1, TAP_2],
  },
  tracks: {
    b0: deal(250).bump(1000, 1.08, 160),
    b1: deal(450).bump(1200, 1.08, 160),
    b2: deal(650).bump(1400, 1.08, 160),
    c1: track().bump(TAP_1 + 60, 1.12, 160),
    ring1: popIn(TAP_1 + 60),
    ok1: popIn(TAP_1 + 120),
    rp1: ripple(TAP_1),
    q1: questionOut(2800),
    q2: questionIn(3000),
    w2: track().shake(TAP_2 + 60),
    x2: popIn(TAP_2 + 60),
    rp2: ripple(TAP_2),
    ring2: popIn(4150),
    lk: popIn(4100),
    lkb: track().to(4200, 1200, { sx: 0 }, "linear"),
  },
});

/** Thẻ đáp án vẽ quanh tâm (để nảy/rung quanh tâm thẻ). */
function CenteredCard({ label }: { label: string }) {
  return <Card x={-50} y={-26} label={label} />;
}

/** Một câu: ba tờ tiền + bốn thẻ; `billKeys` / `cardKeys` = tên làn của tờ / thẻ có chuyển động riêng. */
function Table({
  bills,
  cards,
  billKeys,
  cardKeys,
}: {
  bills: readonly { width: number; fill: string; label: string }[];
  cards: readonly string[];
  billKeys?: readonly string[];
  cardKeys: Readonly<Record<number, string>>;
}) {
  return (
    <>
      {bills.map((bill, i) => {
        const [x, y, angle] = BILL_AT[i] ?? [0, 0, 0];
        const key = billKeys?.[i];
        return key ? (
          <A key={bill.label} k={key} x={x} y={y}>
            <Bill x={0} y={0} angle={angle} bill={bill} />
          </A>
        ) : (
          <Bill key={bill.label} x={x} y={y} angle={angle} bill={bill} />
        );
      })}
      {cards.map((label, i) => {
        const [x, y] = CARD_AT[i] ?? [0, 0];
        const key = cardKeys[i];
        return key ? (
          <A key={label} k={key} x={x} y={y}>
            <CenteredCard label={label} />
          </A>
        ) : (
          <g key={label} transform={`translate(${x} ${y})`}>
            <CenteredCard label={label} />
          </g>
        );
      })}
    </>
  );
}

/** Hình minh hoạ động Đếm tiền nhanh (màn Hướng dẫn); khung tĩnh = `CashCountHowTo`. */
export function CashCountDemo(props: DemoProps) {
  return (
    <DemoStage
      script={CASH_COUNT_SCRIPT}
      still={CashCountHowTo}
      {...props}
      backdrop={
        // Dấu cộng giữa các tờ, ngoặc nhọn gom xấp tiền, dấu bằng (như hình tĩnh, dời phải 40).
        <g
          fill="none"
          className="stroke-chalk filter-[url(#chalk)]"
          strokeWidth={3.5}
          strokeLinecap="round"
        >
          <path d="M94 128 L110 128 M102 120 L102 136" />
          <path d="M94 216 L110 216 M102 208 L102 224" />
          <path d="M272 52 C290 52 288 76 288 108 C288 150 290 166 306 172 C290 178 288 194 288 236 C288 268 290 292 272 292" />
          <path d="M320 165 L342 165 M320 179 L342 179" />
        </g>
      }
    >
      <Question k="q1">
        <Table
          bills={Q1.bills}
          cards={Q1.cards}
          billKeys={["b0", "b1", "b2"]}
          cardKeys={{ 2: "c1" }}
        />
        <Ring k="ring1" x={RIGHT_1[0]} y={RIGHT_1[1]} rx={62} ry={38} />
        <Mark k="ok1" x={RIGHT_1[0] + 50} y={RIGHT_1[1] - 28} kind="ok" />
      </Question>
      <Question k="q2">
        <Table bills={Q2.bills} cards={Q2.cards} cardKeys={{ 1: "w2" }} />
        <Ring k="ring2" x={RIGHT_2[0]} y={RIGHT_2[1]} rx={62} ry={38} />
        <Mark k="x2" x={WRONG_2[0] + 48} y={WRONG_2[1] - 26} kind="bad" />
        <LockPill k="lk" kb="lkb" x={469} y={290} />
      </Question>
      <Ripple k="rp1" x={RIGHT_1[0]} y={RIGHT_1[1]} />
      <Ripple k="rp2" x={WRONG_2[0]} y={WRONG_2[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
