import { useId } from "react";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  flyIn,
  Mark,
  popIn,
  Ring,
  Ripple,
  ripple,
  StepBadge,
  type TrackBuilder,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { Bead, BeadPatternHowTo, type Pattern, PatternDefs, QUESTION } from "./BeadPatternHowTo";

type Point = readonly [number, number];
type BeadSpec = { shape: 0 | 1; pattern: Pattern };

/** Cỡ hạt trên chuỗi và trên thẻ. */
const CHAIN_BEAD = 60;
const CARD_BEAD = 52;
/** Chuỗi 6 chỗ: tâm y 118, x 110 → 530 (bước 84); chỗ cuối là chỗ trống. */
const CHAIN_Y = 118;
const CHAIN_XS = [110, 194, 278, 362, 446, 530] as const;
const BLANK: Point = [CHAIN_XS[5], CHAIN_Y];
/** Chuỗi: tròn sọc / vuông sọc xen kẽ (hình đổi, hoa văn giữ). */
const CHAIN: readonly BeadSpec[] = [0, 1, 0, 1, 0].map((shape) => ({
  shape: shape as 0 | 1,
  pattern: "stripe",
}));
/** Thẻ 120 × 80, lưới 2 × 2: mỗi giá trị hình / hoa văn có ở đúng hai thẻ (như game). */
const CARD = { w: 120, h: 80, r: 14 } as const;
const CARDS: readonly (BeadSpec & { at: Point })[] = [
  { shape: 1, pattern: "stripe", at: [250, 214] },
  { shape: 0, pattern: "stripe", at: [390, 214] },
  { shape: 1, pattern: "checker", at: [250, 302] },
  { shape: 0, pattern: "checker", at: [390, 302] },
];
const ANSWER = CARDS[0] as BeadSpec & { at: Point };
const TAP = 3350;

/** Hạt thứ `i` của chuỗi: nảy vào lần lượt, nhịp theo hình (② tròn rồi vuông), rồi cả chuỗi (hoa văn). */
function chainBead(i: number): TrackBuilder {
  return popIn(250 + 120 * i)
    .bump(i % 2 === 0 ? 1500 : 1800, 1.15, 200)
    .bump(2200, 1.1, 200);
}

/**
 * Kịch bản Chuỗi quy luật (T = 5.400 ms): chuỗi 5 hạt hiện lần lượt + chỗ trống "?" → nhịp các hạt
 * tròn, rồi vuông (hình xen kẽ), rồi cả chuỗi (cùng sọc) → chạm thẻ vuông sọc → ✓, hạt bay lên lấp
 * chỗ trống, ba thẻ còn lại mờ đi.
 */
export const BEAD_PATTERN_SCRIPT = defineScript({
  id: "bead-pattern",
  T: 5400,
  steps: [0, 1400, 2800],
  hand: {
    moves: [
      [2800, 450, [ANSWER.at[0], ANSWER.at[1] + 4]],
      [3900, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    ...Object.fromEntries(CHAIN.map((_, i) => [`b${i}`, chainBead(i)])),
    blank: popIn(850)
      .bump(2500, 1.2, 240)
      .fade(TAP + 300, 120, 0),
    pick: track().bump(TAP + 60, 1.1, 160),
    ring: popIn(TAP + 60),
    ok: popIn(TAP + 120),
    rp: ripple(TAP),
    rest: track().fade(TAP + 150, 200, 0.45),
    fly: flyIn(TAP + 100, {
      x: ANSWER.at[0] - BLANK[0],
      y: ANSWER.at[1] - BLANK[1],
      s: CARD_BEAD / CHAIN_BEAD,
    }),
  },
});

/** Thẻ giấy có bóng đổ, vẽ quanh tâm. */
function CardFace() {
  const left = -CARD.w / 2;
  const top = -CARD.h / 2;
  return (
    <>
      <rect
        x={left}
        y={top + 5}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        className="fill-sticker"
      />
      <rect
        x={left}
        y={top}
        width={CARD.w}
        height={CARD.h}
        rx={CARD.r}
        strokeWidth={3}
        className="fill-card stroke-sticker"
      />
    </>
  );
}

/** Hình minh hoạ động Chuỗi quy luật (màn Hướng dẫn); khung tĩnh = `BeadPatternHowTo`. */
export function BeadPatternDemo(props: DemoProps) {
  // Mẫu hoa văn có id riêng cho mỗi bản hình (như hình tĩnh).
  const base = `bead-demo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ids: Record<Pattern, string> = { stripe: `${base}-stripe`, checker: `${base}-checker` };
  return (
    <DemoStage
      script={BEAD_PATTERN_SCRIPT}
      still={BeadPatternHowTo}
      {...props}
      backdrop={
        // Sợi dây phấn (không filter: nét ngang có khung bao cao 0, như hình tĩnh).
        <g className="stroke-chalk" strokeLinecap="round">
          <path d={`M70 ${CHAIN_Y} L570 ${CHAIN_Y}`} strokeWidth={10} strokeOpacity={0.18} />
          <path d={`M70 ${CHAIN_Y} L570 ${CHAIN_Y}`} strokeWidth={4} />
        </g>
      }
    >
      <defs>
        <PatternDefs ids={ids} size={CHAIN_BEAD} />
        <PatternDefs ids={ids} size={CARD_BEAD} />
      </defs>

      {CHAIN.map(({ shape, pattern }, i) => (
        <A key={CHAIN_XS[i]} k={`b${i}`} x={CHAIN_XS[i]} y={CHAIN_Y}>
          <Bead
            x={0}
            y={0}
            shape={shape}
            pattern={pattern}
            size={CHAIN_BEAD}
            ids={ids}
            edge="stroke-chalk"
          />
        </A>
      ))}

      {/* Chỗ trống: vòng nét đứt + "?" */}
      <A k="blank" x={BLANK[0]} y={BLANK[1]}>
        <g className="stroke-chalk" fill="none" strokeLinecap="round">
          <circle r={CHAIN_BEAD / 2 - 2} strokeWidth={4} strokeDasharray="9 7" />
          <path d={QUESTION} strokeWidth={5} />
          <circle cy={14} r={3.4} className="fill-chalk" stroke="none" />
        </g>
      </A>

      {/* 4 thẻ: thẻ đúng nảy khi chạm, ba thẻ còn lại mờ đi */}
      <A k="rest">
        {CARDS.slice(1).map(({ shape, pattern, at: [x, y] }) => (
          <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
            <CardFace />
            <Bead
              x={0}
              y={0}
              shape={shape}
              pattern={pattern}
              size={CARD_BEAD}
              ids={ids}
              edge="stroke-card-foreground"
            />
          </g>
        ))}
      </A>
      <A k="pick" x={ANSWER.at[0]} y={ANSWER.at[1]}>
        <CardFace />
        <Bead
          x={0}
          y={0}
          shape={ANSWER.shape}
          pattern={ANSWER.pattern}
          size={CARD_BEAD}
          ids={ids}
          edge="stroke-card-foreground"
        />
      </A>
      <Ring k="ring" x={ANSWER.at[0]} y={ANSWER.at[1]} rx={74} ry={52} />
      <Mark k="ok" x={ANSWER.at[0] + CARD.w / 2} y={ANSWER.at[1] - CARD.h / 2} kind="ok" />

      {/* Hạt của thẻ đúng bay lên lấp chỗ trống */}
      <A k="fly" x={BLANK[0]} y={BLANK[1]}>
        <Bead
          x={0}
          y={0}
          shape={ANSWER.shape}
          pattern={ANSWER.pattern}
          size={CHAIN_BEAD}
          ids={ids}
          edge="stroke-chalk"
        />
      </A>
      <Ripple k="rp" x={ANSWER.at[0]} y={ANSWER.at[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
