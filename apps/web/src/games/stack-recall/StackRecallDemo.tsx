import type { StackRecallKind } from "@brain-rizz/shared";
import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  Mark,
  popIn,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import { EYE_LASH_PATH, EYE_PATH, EYE_SHUT_PATH, HAND_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { blockRadius } from "./blocks";
import { Block, StackRecallHowTo } from "./StackRecallHowTo";

/** Tháp tâm x 220 trên bệ (mép trên y 254): khối 112 × 40, bước 44. */
const TOWER_X = 220;
const BASE_TOP = 254;
const BLOCK = { w: 112, h: 40, pitch: 44 } as const;
const layerY = (i: number) => BASE_TOP - 4 - BLOCK.pitch * i - BLOCK.h / 2;
/** Tháp mẫu từ dưới lên: tim sọc chéo, vuông sọc ngang, tam giác chấm bi (như hình tĩnh). */
const TOWER: readonly StackRecallKind[] = [4, 1, 2];
/** Khay 5 khối 44 dưới phải (tròn, vuông, tam giác, sao, tim), tâm y 306. */
const TRAY: readonly StackRecallKind[] = [0, 1, 2, 3, 4];
const TRAY_SIZE = 44;
const TRAY_Y = 306;
const trayX = (slot: number) => 330 + 52 * slot;
/** Biểu tượng pha (mắt · mắt nhắm · bàn tay) bên phải tháp. */
const PHASE = { x: 430, y: 120 } as const;
/** Lượt chạm khay theo thứ tự tầng: [ô khay, mốc chạm]. */
const TAPS: readonly (readonly [slot: number, at: number])[] = [
  [TRAY.indexOf(4), 3300],
  [TRAY.indexOf(1), 3800],
  [TRAY.indexOf(2), 4250],
];
const tapAt = (slot: number) => [trayX(slot), TRAY_Y + 2] as const;
/**
 * Khăn lau đi từ ngoài trái (x −300: khung rộng hơn 16:9 vẫn thấy phần ngoài viewBox) tới x 520;
 * qua giữa tháp lúc ~2.245 ms thì tháp mờ đi.
 */
const WIPE = { at: 1800, dur: 700, from: -300, to: 520 } as const;
const WIPED = WIPE.at + Math.round((WIPE.dur * (TOWER_X - WIPE.from)) / (WIPE.to - WIPE.from)) - 40;

/** Khối rơi xuống chỗ (30 đơn vị) + hiện, 220 ms. */
const drop = (at: number) => track({ y: -30, o: 0 }).to(at, 220, { y: 0, o: 1 });

/**
 * Kịch bản Xếp lại tháp (T = 6.200 ms): tháp xếp dần từ dưới lên tim → vuông → tam giác, số 1 2 3
 * → mắt nhắm, khăn lau quét ngang xoá tháp, còn 3 ô tầng nét đứt → khay hiện, chạm tim, vuông,
 * tam giác; mỗi khối rơi vào đúng tầng → ✓.
 */
export const STACK_RECALL_SCRIPT = defineScript({
  id: "stack-recall",
  T: 6200,
  steps: [0, 1700, 2700],
  hand: {
    moves: [
      [2800, 450, tapAt(TAPS[0]?.[0] ?? 0)],
      [3450, 300, tapAt(TAPS[1]?.[0] ?? 0)],
      [3950, 250, tapAt(TAPS[2]?.[0] ?? 0)],
      [4650, 400, null],
    ],
    taps: TAPS.map(([, at]) => at),
  },
  tracks: {
    ...Object.fromEntries(
      TOWER.flatMap((_, i) => [
        [`t${i}`, drop(300 + 300 * i).fade(WIPED, 120, 0)],
        [`n${i}`, popIn(1000 + 150 * i).fade(WIPED, 120, 0)],
        [`r${i}`, drop((TAPS[i]?.[1] ?? 0) + 100)],
      ]),
    ),
    eye: track().fade(1700, 150, 0),
    shut: track({ o: 0 }).fade(1700, 150).fade(2700, 150, 0),
    tap: track({ o: 0 }).fade(2700, 150),
    wipe: track({ x: WIPE.from - TOWER_X })
      .to(WIPE.at, WIPE.dur, { x: WIPE.to - TOWER_X }, "linear")
      .fade(WIPE.at + WIPE.dur, 150, 0),
    ...Object.fromEntries(
      TRAY.map((kind, slot) => {
        const tapped = TAPS.find(([s]) => s === slot);
        const t = popIn(2700 + 50 * slot);
        return [`y${kind}`, tapped ? t.bump(tapped[1] + 60, 1.15, 160) : t];
      }),
    ),
    ...Object.fromEntries(TAPS.map(([, at], i) => [`rp${i}`, ripple(at)])),
    ok: popIn(4500),
  },
});

/** Biểu tượng pha: mắt mở (xem), mắt nhắm (che), bàn tay (xếp lại); nét trơn ở lớp động. */
function PhaseIcons() {
  const line = {
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "stroke-chalk",
  } as const;
  return (
    <>
      <A k="eye" x={PHASE.x} y={PHASE.y}>
        <path d={EYE_PATH} transform="scale(0.74)" strokeWidth={5.4} {...line} />
        <circle r={9} strokeWidth={3.5} {...line} />
        <circle r={4} className="fill-chalk" />
      </A>
      <A k="shut" x={PHASE.x} y={PHASE.y}>
        <g transform="scale(0.74)">
          <path d={EYE_SHUT_PATH} strokeWidth={5.4} {...line} />
          <path d={EYE_LASH_PATH} strokeWidth={4.7} {...line} />
        </g>
      </A>
      <A k="tap" x={PHASE.x} y={PHASE.y}>
        <path
          d={HAND_PATH}
          transform="scale(2.2) translate(-12.3 -12)"
          strokeWidth={1.9}
          {...line}
        />
      </A>
    </>
  );
}

/** Hình minh hoạ động Xếp lại tháp (màn Hướng dẫn); khung tĩnh = `StackRecallHowTo`. */
export function StackRecallDemo(props: DemoProps) {
  const top = layerY(TOWER.length - 1) - BLOCK.h / 2;
  return (
    <DemoStage
      script={STACK_RECALL_SCRIPT}
      still={StackRecallHowTo}
      {...props}
      backdrop={
        <g className="filter-[url(#chalk)]">
          {/* Ô tầng nét đứt (lộ ra khi khăn lau xoá tháp) + bệ gỗ */}
          {TOWER.map((kind, i) => (
            <rect
              key={kind}
              x={TOWER_X - BLOCK.w / 2}
              y={layerY(i) - BLOCK.h / 2}
              width={BLOCK.w}
              height={BLOCK.h}
              rx={blockRadius(BLOCK.h)}
              className="fill-board-shade stroke-chalk"
              strokeOpacity={0.8}
              strokeWidth={2.5}
              strokeDasharray="6 5"
            />
          ))}
          <rect
            x={TOWER_X - 66}
            y={BASE_TOP}
            width={132}
            height={10}
            rx={5}
            className="fill-wood stroke-chalk"
            strokeWidth={2.5}
          />
        </g>
      }
    >
      {/* Tháp mẫu + thứ tự từ dưới lên */}
      {TOWER.map((kind, i) => (
        <A key={kind} k={`t${i}`}>
          <Block kind={kind} x={TOWER_X} y={layerY(i)} w={BLOCK.w} h={BLOCK.h} />
        </A>
      ))}
      {TOWER.map((kind, i) => (
        <A key={kind} k={`n${i}`} x={TOWER_X + 84} y={layerY(i)}>
          <text
            y={9}
            textAnchor="middle"
            fontSize={26}
            className="fill-chalk font-display font-extrabold"
          >
            {i + 1}
          </text>
        </A>
      ))}

      {/* Khăn lau quét ngang (màu nhóm Ghi nhớ, vệt hồng) */}
      <A k="wipe" x={TOWER_X} y={layerY(1)}>
        <rect
          x={-46}
          y={-92}
          width={92}
          height={184}
          rx={12}
          strokeWidth={2.5}
          className="fill-memorize stroke-chalk"
        />
        <path
          d="M-36 86 L10 -84 M-4 86 L38 -70"
          fill="none"
          strokeWidth={9}
          strokeOpacity={0.55}
          strokeLinecap="round"
          className="stroke-pink"
        />
      </A>

      {/* Tháp xếp lại: khối rơi vào đúng tầng sau mỗi lượt chạm */}
      {TOWER.map((kind, i) => (
        <A key={kind} k={`r${i}`}>
          <Block kind={kind} x={TOWER_X} y={layerY(i)} w={BLOCK.w} h={BLOCK.h} />
        </A>
      ))}
      <Mark k="ok" x={TOWER_X + BLOCK.w / 2 + 10} y={top - 6} kind="ok" />

      <PhaseIcons />

      {/* Khay */}
      {TRAY.map((kind, slot) => (
        <A key={kind} k={`y${kind}`} x={trayX(slot)} y={TRAY_Y}>
          <Block kind={kind} x={0} y={0} w={TRAY_SIZE} h={TRAY_SIZE} />
        </A>
      ))}
      {TAPS.map(([slot], i) => (
        <Ripple key={slot} k={`rp${i}`} x={trayX(slot)} y={TRAY_Y} />
      ))}
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
