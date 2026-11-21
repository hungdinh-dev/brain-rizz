import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  flashes,
  Mark,
  popIn,
  Ripple,
  ripple,
  StepBadge,
  type TrackBuilder,
  track,
} from "../_shared/demo";
import { HAND_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { Drum, Pattern, RhythmEchoHowTo, type Side } from "./RhythmEchoHowTo";
import { EAR_PATH, NOTE_STEM_PATH } from "./shapes";

/** Hai trống r 50: trái (262, 160) hoa văn vòng đồng tâm, phải (378, 160) dây chéo. */
const R = 50;
const DRUM_Y = 160;
const DRUM_X: Record<Side, number> = { left: 262, right: 378 };

/** Câu nhịp: trái · phải · phải (sát, 260 ms) · trái (sau quãng dài) — khoảng cách không đều. */
const BEATS: readonly { side: Side; at: number }[] = [
  { side: "left", at: 500 },
  { side: "right", at: 900 },
  { side: "right", at: 1160 },
  { side: "left", at: 1760 },
];
/** Lượt gõ lại: cùng trống, cùng khoảng cách, lệch `ECHO` ms. */
const ECHO = 2100;
/** Trống sáng sau chạm 60 ms (khung diễn). */
const D = 60;
const TAPS = BEATS.map(({ side, at }) => ({ side, at: at + ECHO }));

/** Dải nhịp: chấm của câu mẫu (y 270) và chấm vừa gõ (y 306), x theo thời gian 0,2 đơn vị/ms. */
const ROW_Y = { ref: 270, tap: 306 } as const;
const beatX = (ms: number) => 220 + (ms - (BEATS[0]?.at ?? 0)) * 0.2;
const XS = BEATS.map(({ at }) => beatX(at));

const ALIGN = 4000;

/** Trống sáng: hiện ngay, tắt sau 120 ms (80 ms mờ), đủ ngắn cho hai tiếng sát nhau. */
const lit = (times: readonly number[]) =>
  flashes(
    times.map((at) => [at, at + 120] as const),
    79,
  );

/** Sóng lan quanh trống sáng: 1 → 1,4 và tan trong 190 ms. */
function waves(times: readonly number[]): TrackBuilder {
  const t = track({ o: 0 });
  for (const at of times) t.jump(at, { o: 0.8, s: 1 }).to(at + 1, 190, { s: 1.4, o: 0 });
  return t;
}

const timesOf = (list: readonly { side: Side; at: number }[], side: Side, delay = 0) =>
  list.filter((b) => b.side === side).map((b) => b.at + delay);

/**
 * Kịch bản Nhại nhịp (CR-021, T = 5.400 ms): pha nghe (tai) — trống trái, phải, phải, trái sáng
 * theo câu nhịp, nốt nhạc bay lên, dải nhịp hiện từng chấm → pha gõ (bàn tay) — tay gõ lại đúng
 * trống, đúng khoảng cách, chấm vừa gõ hiện dưới chấm mẫu → nét nối thẳng hàng + ✓.
 */
export const RHYTHM_ECHO_SCRIPT = defineScript({
  id: "re",
  T: 5400,
  steps: [0, ECHO + 100, ALIGN - 50],
  hand: {
    moves: [
      [2150, 400, [DRUM_X.left, DRUM_Y + 8]],
      [2700, 250, [DRUM_X.right, DRUM_Y + 8]],
      [3350, 350, [DRUM_X.left, DRUM_Y + 8]],
      [4100, 400, null],
    ],
    taps: TAPS.map((tap) => tap.at),
  },
  tracks: {
    ear: track().fade(ECHO + 100, 150, 0),
    ph: track({ s: 0.6, o: 0 }).pop(ECHO + 100, 150),
    litL: lit([...timesOf(BEATS, "left"), ...timesOf(TAPS, "left", D)]),
    litR: lit([...timesOf(BEATS, "right"), ...timesOf(TAPS, "right", D)]),
    wL: waves([...timesOf(BEATS, "left"), ...timesOf(TAPS, "left", D)]),
    wR: waves([...timesOf(BEATS, "right"), ...timesOf(TAPS, "right", D)]),
    ...Object.fromEntries(
      BEATS.flatMap(({ at }, i) => [
        // Nốt nhạc bay lên khỏi trống trong pha nghe.
        [
          `nt${i}`,
          track({ o: 0 })
            .jump(at, { o: 1 })
            .to(at + 1, 499, { y: -46, o: 0 }, "linear"),
        ],
        [`r${i}`, popIn(at, 200)],
        [`t${i}`, popIn(at + ECHO + D, 200)],
        [`rp${i}`, ripple(at + ECHO)],
      ]),
    ),
    link: track({ o: 0 }).fade(ALIGN, 200),
    ok: popIn(ALIGN + 120),
  },
});

/** Trống sáng (nét trơn): nền vàng to 106 %, viền mực, vòng phấn trong, hoa văn mực. */
function LitDrum({ side }: { side: Side }) {
  const big = R * 1.06;
  return (
    <>
      <circle r={big} strokeWidth={4} className="fill-primary stroke-ink" />
      <circle r={big - 6} strokeWidth={3.5} className="fill-none stroke-chalk" />
      <Pattern
        r={big - 4}
        side={side}
        className="stroke-ink text-ink opacity-85 [stroke-width:2.4]"
      />
    </>
  );
}

/** Nốt nhạc móc đơn (nét trơn), đầu nốt ở gốc. */
function Note() {
  return (
    <g className="stroke-chalk" strokeLinecap="round" strokeLinejoin="round">
      <ellipse rx={7.5} ry={5.5} transform="rotate(-20)" className="fill-chalk" stroke="none" />
      <path d={NOTE_STEM_PATH} fill="none" strokeWidth={3.5} />
    </g>
  );
}

/** Hình minh hoạ động Nhại nhịp (màn Hướng dẫn); khung tĩnh = `RhythmEchoHowTo`. */
export function RhythmEchoDemo(props: DemoProps) {
  return (
    <DemoStage
      script={RHYTHM_ECHO_SCRIPT}
      still={RhythmEchoHowTo}
      {...props}
      backdrop={
        <>
          <Drum x={DRUM_X.left} y={DRUM_Y} r={R} side="left" />
          <Drum x={DRUM_X.right} y={DRUM_Y} r={R} side="right" />
          {/* Vạch thời gian: hình chữ nhật mảnh (filter phấn cắt mất đường có khung bao cao 0) */}
          <g className="fill-chalk opacity-50 filter-[url(#chalk)]">
            <rect x={196} y={ROW_Y.ref - 1.5} width={288} height={3} rx={1.5} />
            <rect x={196} y={ROW_Y.tap - 1.5} width={288} height={3} rx={1.5} />
          </g>
        </>
      }
    >
      {/* Biểu tượng pha: tai (nghe) → bàn tay (gõ lại) */}
      <A k="ear" x={118} y={160}>
        <path
          d={EAR_PATH}
          transform="scale(2.1) translate(-12.5 -12)"
          fill="none"
          className="stroke-chalk"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </A>
      <A k="ph" x={118} y={160}>
        <path
          d={HAND_PATH}
          transform="scale(2) translate(-12.3 -12)"
          fill="none"
          className="stroke-chalk"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </A>

      {(["left", "right"] as const).map((side) => {
        const suffix = side === "left" ? "L" : "R";
        return (
          <g key={side} transform={`translate(${DRUM_X[side]} ${DRUM_Y})`}>
            <A k={`w${suffix}`}>
              <circle r={R * 1.06 + 10} fill="none" className="stroke-primary" strokeWidth={4} />
            </A>
            <A k={`lit${suffix}`}>
              <LitDrum side={side} />
            </A>
          </g>
        );
      })}
      {BEATS.map(({ side, at }, i) => (
        <A key={at} k={`nt${i}`} x={DRUM_X[side] + (side === "left" ? -42 : 42)} y={DRUM_Y - 56}>
          <Note />
        </A>
      ))}

      {/* Dải nhịp: chấm mẫu (đặc phấn), chấm vừa gõ (vàng), nét nối thẳng hàng ở bước ③ */}
      <A k="link">
        <g fill="none" className="stroke-primary" strokeWidth={3} strokeDasharray="4 4">
          {XS.map((x) => (
            <path key={x} d={`M${x} ${ROW_Y.ref + 10} L${x} ${ROW_Y.tap - 10}`} />
          ))}
        </g>
      </A>
      {XS.map((x, i) => (
        <g key={x}>
          <A k={`r${i}`} x={x} y={ROW_Y.ref}>
            <circle r={8} className="fill-chalk" />
          </A>
          <A k={`t${i}`} x={x} y={ROW_Y.tap}>
            <circle r={9} className="fill-primary stroke-ink" strokeWidth={2.5} />
          </A>
        </g>
      ))}
      <Mark
        k="ok"
        x={(XS[XS.length - 1] as number) + 48}
        y={(ROW_Y.ref + ROW_Y.tap) / 2}
        kind="ok"
      />
      {TAPS.map(({ side, at }, i) => (
        <Ripple key={at} k={`rp${i}`} x={DRUM_X[side]} y={DRUM_Y + 8} />
      ))}
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
