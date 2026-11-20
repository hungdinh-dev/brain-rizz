import type { BalanceItem } from "@brain-rizz/shared";
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
import { BalanceHowTo, Item } from "./BalanceHowTo";

/** Hai cân trụ x 330, chốt y 60 và 166; đầu đòn ±77,6; nghiêng 14° thì đĩa lệch 19,35. */
const PIVOT_X = 330;
const TOP = 60;
const BOTTOM = 166;
const LEFT_X = 252.4;
const RIGHT_X = 407.6;
/** Hàng lựa chọn: ô 54 tại x 258 · 330 · 402, y 293; đáp án là dưa hấu (giữa). */
const CHOICES: { item: BalanceItem; x: number }[] = [
  { item: "banana", x: 258 },
  { item: "watermelon", x: 330 },
  { item: "apple", x: 402 },
];
const ANSWER = { x: 330, y: 293 } as const;
const TAP = 3500;

/** Đòn nghiêng từ 7° tới 14° (180 ms, settle); đĩa hạ/nâng theo (9,75 → 19,35). */
const beam = (deg: number) => track({ r: deg / 2 }).to(300, 180, { r: deg });
/** `sign` 1 = đĩa hạ (bên nặng), −1 = đĩa nâng. */
const pan = (sign: 1 | -1) => track({ y: sign * 9.75 }).to(300, 180, { y: sign * 19.35 });

/**
 * Kịch bản Cân não (UI-UX 6.11, T = 5.400 ms): hai cân nghiêng, khoanh đĩa thấp (bên nặng) →
 * cân nhỏ thăng bằng "=" → chạm vật nặng nhất (dưa hấu) → ✓.
 */
export const BALANCE_SCRIPT = defineScript({
  id: "ba",
  T: 5400,
  steps: [0, 1900, 2900],
  hand: {
    moves: [
      [2900, 500, [ANSWER.x, ANSWER.y + 2]],
      [4000, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    // Cân trên: táo (trái) thấp hơn chuối; cân dưới: dưa hấu (phải) thấp hơn táo.
    abeam: beam(-14),
    apl: pan(1),
    apr: pan(-1),
    bbeam: beam(14),
    bpl: pan(-1),
    bpr: pan(1),
    hA: popIn(700),
    aA: popIn(700),
    hB: popIn(1300),
    aB: popIn(1300),
    mini: track({ s: 0.9, o: 0 }).to(1900, 200, { s: 1, o: 1 }),
    eq: track().to(2050, 120, { s: 1.3 }).to(2170, 120, { s: 1 }, "pop"),
    hM: popIn(2100),
    card: track().bump(TAP + 60, 1.15, 160),
    hC: popIn(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
  },
});

/** Đĩa cân treo (nét trơn, không filter vì đĩa chuyển động): `small` cho cân nhỏ. */
function Pan({ small }: { small?: boolean }) {
  return small ? (
    <>
      <path d="M0 0 L-18 30 M0 0 L18 30" fill="none" className="stroke-chalk" strokeWidth={2} />
      <path
        d="M-22 30 L22 30 C19 37 11 39 0 39 C-11 39 -19 37 -22 30 Z"
        className="fill-board-shade stroke-chalk"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </>
  ) : (
    <>
      <path d="M0 0 L-26 44 M0 0 L26 44" fill="none" className="stroke-chalk" strokeWidth={2.2} />
      <path
        d="M-30 44 L30 44 C26 52 15 55 0 55 C-15 55 -26 52 -30 44 Z"
        className="fill-board-shade stroke-chalk"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </>
  );
}

/** Mũi tên ↓ vàng cạnh đĩa thấp. */
function Down() {
  return (
    <path
      d="M0 -14 L0 12 M-8 4 L0 13 L8 4"
      fill="none"
      className="stroke-primary"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Đòn cân + chốt tại (330, y). */
function Beam({ k, y }: { k: string; y: number }) {
  return (
    <>
      <A k={k} x={PIVOT_X} y={y}>
        <path
          d="M-80 0 L80 0"
          fill="none"
          className="stroke-chalk"
          strokeWidth={5}
          strokeLinecap="round"
        />
      </A>
      <circle cx={PIVOT_X} cy={y} r={5} className="fill-chalk" />
    </>
  );
}

/** Ô lựa chọn: thẻ giấy viền mực có bóng + vật. */
function Choice({ item }: { item: BalanceItem }) {
  return (
    <>
      <rect x={-27} y={-24} width={54} height={54} rx={10} className="fill-ink" />
      <rect
        x={-27}
        y={-27}
        width={54}
        height={54}
        rx={10}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
      <Item item={item} x={0} y={0} size={0.4} />
    </>
  );
}

/** Hình minh hoạ động Cân não (màn Hướng dẫn); khung tĩnh = `BalanceHowTo`. */
export function BalanceDemo(props: DemoProps) {
  return (
    <DemoStage
      script={BALANCE_SCRIPT}
      still={BalanceHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          <rect
            x={196}
            y={12}
            width={268}
            height={336}
            rx={18}
            className="fill-board-shade stroke-chalk/85"
            strokeWidth={3}
          />
          {[TOP, BOTTOM].map((y) => (
            <g key={y}>
              <path
                d={`M${PIVOT_X} ${y} L${PIVOT_X} ${y + 74}`}
                fill="none"
                className="stroke-chalk"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <path
                d={`M296 ${y + 80} L302 ${y + 70} L358 ${y + 70} L364 ${y + 80} Z`}
                className="fill-analyze stroke-chalk"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </g>
          ))}
          <path
            d="M216 254 C280 251 380 257 444 253"
            fill="none"
            className="stroke-chalk/70"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      }
    >
      {/* Cân trên: táo – chuối */}
      <Beam k="abeam" y={TOP} />
      <A k="apl" x={LEFT_X} y={TOP}>
        <Pan />
        <Item item="apple" x={0} y={24} size={0.42} />
        <Ring k="hA" x={0} y={24} rx={30} />
        <A k="aA" x={-44} y={30}>
          <Down />
        </A>
      </A>
      <A k="apr" x={RIGHT_X} y={TOP}>
        <Pan />
        <Item item="banana" x={0} y={24} size={0.42} />
      </A>

      {/* Cân dưới: táo – dưa hấu */}
      <Beam k="bbeam" y={BOTTOM} />
      <A k="bpl" x={LEFT_X} y={BOTTOM}>
        <Pan />
        <Item item="apple" x={0} y={24} size={0.42} />
      </A>
      <A k="bpr" x={RIGHT_X} y={BOTTOM}>
        <Pan />
        <Item item="watermelon" x={0} y={24} size={0.42} />
        <Ring k="hB" x={0} y={24} rx={30} />
        <A k="aB" x={44} y={30}>
          <Down />
        </A>
      </A>

      {/* Cân nhỏ thăng bằng bên trái khung: nấm = cà rốt */}
      <A k="mini" x={126} y={54}>
        <g fill="none" className="stroke-chalk" strokeLinecap="round">
          <path d="M0 0 L0 58" strokeWidth={3.5} />
          <path d="M-46 0 L46 0" strokeWidth={4} />
        </g>
        <path
          d="M-20 66 L-14 58 L14 58 L20 66 Z"
          className="fill-analyze stroke-chalk"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <circle r={4} className="fill-chalk" />
        <g transform="translate(-46 0)">
          <Pan small />
          <Item item="mushroom" x={0} y={14} size={0.34} />
        </g>
        <g transform="translate(46 0)">
          <Pan small />
          <Item item="carrot" x={0} y={14} size={0.34} />
        </g>
        <A k="eq" y={34}>
          <circle r={11} className="fill-analyze stroke-chalk" strokeWidth={2.2} />
          <path
            d="M-5 -3 L5 -3 M-5 3 L5 3"
            fill="none"
            className="stroke-ink"
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        </A>
      </A>
      <Ring k="hM" x={126} y={66} rx={66} ry={46} />

      {/* Hàng lựa chọn */}
      {CHOICES.map(({ item, x }) =>
        x === ANSWER.x ? (
          <A key={item} k="card" x={x} y={ANSWER.y}>
            <Choice item={item} />
          </A>
        ) : (
          <g key={item} transform={`translate(${x} ${ANSWER.y})`}>
            <Choice item={item} />
          </g>
        ),
      )}
      <Ring k="hC" x={ANSWER.x} y={ANSWER.y} rx={40} ry={36} />
      <Mark k="ok" x={ANSWER.x + 32} y={ANSWER.y - 31} kind="ok" />
      <Ripple k="rp" x={ANSWER.x} y={ANSWER.y} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
