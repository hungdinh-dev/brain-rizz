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
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { Card, HitTargetHowTo } from "./HitTargetHowTo";

/** Hồng tâm ghi số đích 15 bên trái. */
const TARGET = { x: 134, y: 196, value: 15 } as const;
/** Khay 3 ô (mức Thường, chọn 3): ô 56 tại x 268 · 344 · 420, "+" giữa các ô, "=" và ô tổng. */
const TRAY_Y = 120;
const SLOT_XS = [268, 344, 420] as const;
const SUM = { x: 514, w: 76, h: 56 } as const;
/** Hàng thẻ 76 × 76. */
const CARD_Y = 266;
const CARDS = [
  { value: 3, x: 268 },
  { value: 9, x: 358 },
  { value: 5, x: 448 },
  { value: 7, x: 538 },
] as const;
const cardAt = (i: number) => {
  const card = CARDS[i] as (typeof CARDS)[number];
  return [card.x, CARD_Y + 2] as const;
};

/** Mốc chạm: 3, 9, bỏ chọn 9, 5, 7 (khay đầy là tự nộp). */
const TAP_3 = 1050;
const TAP_9 = 1550;
const UNTAP_9 = 2200;
const TAP_5 = 2700;
const TAP_7 = 3200;
/** Thẻ phản hồi sau chạm 60 ms (khung diễn). */
const D = 60;
/** Mỗi lần chạm: mốc và thẻ được chạm (chỉ số trong `CARDS`). */
const TAPS = [
  { at: TAP_3, card: 0 },
  { at: TAP_9, card: 1 },
  { at: UNTAP_9, card: 1 },
  { at: TAP_5, card: 2 },
  { at: TAP_7, card: 3 },
] as const;

/** Chip vào khay: nảy 0,6 → 1 (160 ms). */
const chipIn = (at: number) => popIn(at, 160, 0.6);

/**
 * Kịch bản Chạm đích (CR-021, T = 5.000 ms): nhìn số đích 15 → chạm 3 rồi 9 (khay 3 + 9, tổng 12) →
 * chạm lại 9 để bỏ chọn → chạm 5 và 7: khay đầy, tổng 15 = đích → ✓.
 */
export const HIT_TARGET_SCRIPT = defineScript({
  id: "ht",
  T: 5000,
  steps: [0, 1000, 2100],
  hand: {
    moves: [
      [500, 450, cardAt(0)],
      [1250, 250, cardAt(1)],
      [2350, 250, cardAt(2)],
      [2850, 250, cardAt(3)],
      [3600, 400, null],
    ],
    taps: TAPS.map((tap) => tap.at),
  },
  tracks: {
    tg: track()
      .bump(400, 1.08, 300)
      .bump(TAP_7 + D, 1.1, 240),
    sel3: track({ o: 0 }).fade(TAP_3 + D, 80),
    sel9: track({ o: 0 })
      .fade(TAP_9 + D, 80)
      .fade(UNTAP_9 + D, 80, 0),
    sel5: track({ o: 0 }).fade(TAP_5 + D, 80),
    sel7: track({ o: 0 }).fade(TAP_7 + D, 80),
    c1: chipIn(TAP_3 + D),
    c2a: chipIn(TAP_9 + D).to(UNTAP_9 + D, 140, { s: 0.6, o: 0 }),
    c2b: chipIn(TAP_5 + D),
    c3: chipIn(TAP_7 + D),
    // Số trong ô tổng bật/tắt tức thì: [mốc hiện, mốc ẩn].
    n0: flashes([[0, TAP_3 + D]]),
    n3: flashes([
      [TAP_3 + D, TAP_9 + D],
      [UNTAP_9 + D, TAP_5 + D],
    ]),
    n12: flashes([[TAP_9 + D, UNTAP_9 + D]]),
    n8: flashes([[TAP_5 + D, TAP_7 + D]]),
    n15: flashes([[TAP_7 + D]]).bump(TAP_7 + D + 1, 1.2, 240),
    ...Object.fromEntries(TAPS.map((tap, i) => [`rp${i}`, ripple(tap.at)])),
    ok: popIn(TAP_7 + 120),
  },
});

/** Chip kem trong khay. */
function Chip({ value }: { value: number }) {
  return (
    <>
      <rect x={-26} y={-24} width={52} height={52} rx={10} className="fill-ink" />
      <rect
        x={-26}
        y={-26}
        width={52}
        height={52}
        rx={10}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
      <text
        y={10}
        textAnchor="middle"
        fontSize={30}
        className="fill-ink font-display font-extrabold"
      >
        {value}
      </text>
    </>
  );
}

/** Hình minh hoạ động Chạm đích (màn Hướng dẫn); khung tĩnh = `HitTargetHowTo`. */
export function HitTargetDemo(props: DemoProps) {
  return (
    <DemoStage
      script={HIT_TARGET_SCRIPT}
      still={HitTargetHowTo}
      {...props}
      backdrop={
        <>
          <g className="filter-[url(#chalk)]">
            <g className="fill-board-shade stroke-chalk/80" strokeWidth={2.5} strokeDasharray="7 5">
              {SLOT_XS.map((x) => (
                <rect key={x} x={x - 28} y={TRAY_Y - 28} width={56} height={56} rx={10} />
              ))}
            </g>
            <g className="fill-chalk font-display font-extrabold" fontSize={30} textAnchor="middle">
              <text x={306} y={TRAY_Y + 10}>
                +
              </text>
              <text x={382} y={TRAY_Y + 10}>
                +
              </text>
              <text x={458} y={TRAY_Y + 10}>
                =
              </text>
            </g>
          </g>
          <rect
            x={SUM.x - SUM.w / 2}
            y={TRAY_Y - SUM.h / 2}
            width={SUM.w}
            height={SUM.h}
            rx={12}
            className="fill-ink stroke-chalk/60"
            strokeWidth={2}
          />
          {CARDS.map(({ value, x }) => (
            <Card key={value} x={x} y={CARD_Y} value={value} />
          ))}
        </>
      }
    >
      {/* Hồng tâm: vòng xanh nhóm Tính toán, mặt kem ghi số đích */}
      <A k="tg" x={TARGET.x} y={TARGET.y}>
        <circle cy={4} r={64} className="fill-ink" />
        <circle r={64} className="fill-compute stroke-ink" strokeWidth={3.5} />
        <path
          d="M0 -59 L0 -51 M0 51 L0 59 M-59 0 L-51 0 M51 0 L59 0"
          fill="none"
          className="stroke-paper"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle r={48} className="fill-paper stroke-ink" strokeWidth={3} />
        <text
          y={18}
          textAnchor="middle"
          fontSize={50}
          className="fill-ink font-display font-extrabold"
        >
          {TARGET.value}
        </text>
      </A>

      {/* Thẻ đã chọn: lún xuống, nền xanh nhạt, viền đậm */}
      {CARDS.map(({ value, x }) => (
        <A key={value} k={`sel${value}`}>
          <Card x={x} y={CARD_Y} value={value} on />
        </A>
      ))}

      {/* Chip trong khay */}
      <A k="c1" x={SLOT_XS[0]} y={TRAY_Y}>
        <Chip value={3} />
      </A>
      <A k="c2a" x={SLOT_XS[1]} y={TRAY_Y}>
        <Chip value={9} />
      </A>
      <A k="c2b" x={SLOT_XS[1]} y={TRAY_Y}>
        <Chip value={5} />
      </A>
      <A k="c3" x={SLOT_XS[2]} y={TRAY_Y}>
        <Chip value={7} />
      </A>

      {/* Ô tổng: hiện tổng các thẻ đang chọn */}
      {[0, 3, 12, 8, 15].map((n) => (
        <A key={n} k={`n${n}`} x={SUM.x} y={TRAY_Y}>
          <text
            y={11}
            textAnchor="middle"
            fontSize={30}
            className="fill-sun font-display font-extrabold"
          >
            {n}
          </text>
        </A>
      ))}

      <Mark k="ok" x={TARGET.x + 52} y={TARGET.y - 54} kind="ok" />
      {TAPS.map((tap, i) => {
        const [x, y] = cardAt(tap.card);
        return <Ripple key={tap.at} k={`rp${i}`} x={x} y={y} />;
      })}
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
