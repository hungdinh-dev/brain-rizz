import type { WhoVanishedItem } from "@brain-rizz/shared";
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
import { EYE_LASH_PATH, EYE_PATH, EYE_SHUT_PATH, HAND_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { Item, WhoVanishedHowTo } from "./WhoVanishedHowTo";

type Point = readonly [number, number];

/** Khay 2 × 2 (khung 176 tại (232, 22)), ô 76 bước 84; món ở tâm ô. */
const TRAY = { x: 232, y: 22, size: 176 } as const;
const CELL = 76;
const TRAY_ITEMS: readonly { item: WhoVanishedItem; at: Point }[] = [
  { item: "apple", at: [278, 68] },
  { item: "carrot", at: [362, 68] },
  { item: "watermelon", at: [278, 152] },
  { item: "banana", at: [362, 152] },
];
const ITEM_SIZE = 0.55;
/** Món biến mất: chuối ở ô dưới phải. */
const GONE = TRAY_ITEMS[3] as (typeof TRAY_ITEMS)[number];
/** Thanh xem dưới khay rút từ đủ về 0 trong pha xem. */
const BAR = { x: 260, y: 212, w: 120, h: 10 } as const;
/** Ba thẻ lựa chọn 60 × 60 dưới khay. */
const CARD_Y = 284;
const CARD_SIZE = 0.42;
const CARDS: readonly { item: WhoVanishedItem; x: number }[] = [
  { item: "mushroom", x: 250 },
  { item: "banana", x: 320 },
  { item: "strawberry", x: 390 },
];
const PICK: Point = [320, CARD_Y];
/** Biểu tượng pha bên trái khay. */
const PHASE: Point = [150, 110];

/** Rèm hạ (1.550–1.850), món biến mất sau rèm (1.950), rèm kéo lên (2.150–2.450). */
const CURTAIN_DOWN = 1550;
const CURTAIN_UP = 2150;
const REVEAL = 2450;
const TAP = 3150;
/** Rèm phủ kín khay, mép dưới lượn sóng; chờ ở trên sân khấu (dời lên 230). */
const CURTAIN_PATH =
  "M228 18 L412 18 L412 196 C400 210 377 210 366 196 C354 210 331 210 320 196 C308 210 285 210 274 196 C262 210 239 210 228 196 Z";
const CURTAIN_FOLDS = "M274 24 L274 192 M320 24 L320 192 M366 24 L366 192";
const CURTAIN_OFF = -230;

/**
 * Kịch bản Ai vừa biến mất (CR-021, T = 5.000 ms): pha xem (mắt) — khay 4 món, thanh xem rút dần →
 * rèm hạ (mắt nhắm), chuối biến mất → rèm kéo lên lộ ô trống "?", ba thẻ hiện (bàn tay) → chạm thẻ
 * chuối → chuối bay về ô trống → ✓.
 */
export const WHO_VANISHED_SCRIPT = defineScript({
  id: "wv",
  T: 5000,
  steps: [0, CURTAIN_DOWN, REVEAL],
  hand: {
    moves: [
      [2600, 450, [PICK[0], PICK[1] + 2]],
      [3600, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    eye: track().fade(CURTAIN_DOWN, 150, 0),
    shut: track({ o: 0 }).fade(CURTAIN_DOWN, 150).fade(REVEAL, 150, 0),
    ph: track({ s: 0.6, o: 0 }).pop(REVEAL, 150),
    bar: track().to(300, 1200, { sx: 0 }, "linear"),
    cur: track({ y: CURTAIN_OFF })
      .to(CURTAIN_DOWN, 300, { y: 0 }, "settle")
      .to(CURTAIN_UP, 300, { y: CURTAIN_OFF }, "glide"),
    gone: track().jump(1950, { o: 0 }),
    q: track({ o: 0 })
      .jump(CURTAIN_UP, { o: 1 })
      .fade(TAP + 250, 150, 0),
    k0: popIn(REVEAL),
    k1: popIn(REVEAL + 60),
    k2: popIn(REVEAL + 120),
    rp: ripple(TAP),
    ring: popIn(TAP + 60),
    fly: track({ o: 0 })
      .jump(TAP + 60, { o: 1 })
      .to(
        TAP + 61,
        300,
        { x: GONE.at[0] - PICK[0], y: GONE.at[1] - PICK[1], s: ITEM_SIZE / CARD_SIZE },
        "glide",
      ),
    ok: popIn(TAP + 380),
  },
});

/** Thẻ lựa chọn: giấy viền mực có bóng, món ở giữa. */
function ChoiceCard({ item }: { item: WhoVanishedItem }) {
  return (
    <>
      <rect x={-30} y={-27} width={60} height={60} rx={11} className="fill-ink" />
      <rect
        x={-30}
        y={-30}
        width={60}
        height={60}
        rx={11}
        className="fill-paper stroke-ink"
        strokeWidth={3}
      />
      <Item item={item} x={0} y={0} size={CARD_SIZE} />
    </>
  );
}

/** Hình minh hoạ động Ai vừa biến mất (màn Hướng dẫn); khung tĩnh = `WhoVanishedHowTo`. */
export function WhoVanishedDemo(props: DemoProps) {
  return (
    <DemoStage
      script={WHO_VANISHED_SCRIPT}
      still={WhoVanishedHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          <rect
            x={TRAY.x}
            y={TRAY.y}
            width={TRAY.size}
            height={TRAY.size}
            rx={16}
            className="fill-none stroke-memorize"
            strokeWidth={3.5}
          />
          <g className="fill-board-shade stroke-chalk/80" strokeWidth={3}>
            {TRAY_ITEMS.map(({ at: [x, y] }) => (
              <rect
                key={`${x},${y}`}
                x={x - CELL / 2}
                y={y - CELL / 2}
                width={CELL}
                height={CELL}
                rx={11}
              />
            ))}
          </g>
          <rect
            x={BAR.x}
            y={BAR.y}
            width={BAR.w}
            height={BAR.h}
            rx={BAR.h / 2}
            className="fill-none stroke-chalk"
            strokeWidth={2.5}
          />
        </g>
      }
    >
      {/* Biểu tượng pha: mắt mở (xem) → mắt nhắm (rèm) → bàn tay (chọn) */}
      <A k="eye" x={PHASE[0]} y={PHASE[1]}>
        <g fill="none" className="stroke-chalk" strokeLinejoin="round">
          <path d={EYE_PATH} transform="scale(0.74)" strokeWidth={5.4} />
          <circle r={9} strokeWidth={3.5} />
        </g>
        <circle r={4} className="fill-chalk" />
      </A>
      <A k="shut" x={PHASE[0]} y={PHASE[1]}>
        <g transform="scale(0.74)" fill="none" className="stroke-chalk" strokeLinecap="round">
          <path d={EYE_SHUT_PATH} strokeWidth={5.4} />
          <path d={EYE_LASH_PATH} strokeWidth={4.7} />
        </g>
      </A>
      <A k="ph" x={PHASE[0]} y={PHASE[1]}>
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

      {/* Thanh xem rút dần */}
      <A k="bar" x={BAR.x} y={BAR.y}>
        <rect width={BAR.w} height={BAR.h} rx={BAR.h / 2} className="fill-memorize" />
      </A>

      {/* Khay: ba món đứng yên, chuối biến mất sau rèm */}
      {TRAY_ITEMS.filter((t) => t !== GONE).map(({ item, at: [x, y] }) => (
        <Item key={item} item={item} x={x} y={y} size={ITEM_SIZE} />
      ))}
      <A k="gone" x={GONE.at[0]} y={GONE.at[1]}>
        <Item item={GONE.item} x={0} y={0} size={ITEM_SIZE} />
      </A>
      <A k="q" x={GONE.at[0]} y={GONE.at[1]}>
        <rect
          x={-CELL / 2}
          y={-CELL / 2}
          width={CELL}
          height={CELL}
          rx={11}
          className="fill-memorize/20 stroke-chalk"
          strokeWidth={3}
          strokeDasharray="7 6"
        />
        <text
          y={15}
          textAnchor="middle"
          fontSize={44}
          className="fill-chalk font-display font-extrabold"
        >
          ?
        </text>
      </A>

      {/* Rèm hồng hạ xuống che khay rồi kéo lên */}
      <A k="cur">
        <path
          d={CURTAIN_PATH}
          className="fill-memorize stroke-chalk"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d={CURTAIN_FOLDS}
          className="fill-none stroke-ink/35"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </A>

      {/* Ba thẻ lựa chọn */}
      {CARDS.map(({ item, x }, i) => (
        <A key={item} k={`k${i}`} x={x} y={CARD_Y}>
          <ChoiceCard item={item} />
        </A>
      ))}
      <Ring k="ring" x={PICK[0]} y={PICK[1]} rx={40} ry={40} />
      <A k="fly" x={PICK[0]} y={PICK[1]}>
        <Item item={GONE.item} x={0} y={0} size={CARD_SIZE} />
      </A>
      <Mark k="ok" x={GONE.at[0] + 44} y={GONE.at[1] - 44} kind="ok" />
      <Ripple k="rp" x={PICK[0]} y={PICK[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
