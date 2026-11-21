import {
  A,
  Cursor,
  DemoStage,
  defineScript,
  IconBadge,
  Mark,
  popIn,
  Question,
  questionIn,
  questionOut,
  RectRing,
  Ripple,
  ripple,
  StepBadge,
  track,
} from "../_shared/demo";
import type { DemoProps } from "../types";
import { ChalkCard, ColoredItem, Shadow, ShadowMatchHowTo } from "./ShadowMatchHowTo";

type Point = readonly [x: number, y: number];

/** Thẻ đề (giấy) bên trái: góc trên trái, cỡ; tâm vật. */
const MODEL = { x: 70, y: 92, w: 150, h: 180 } as const;
const MODEL_AT: Point = [145, 174];
/** Ba thẻ bóng 100 × 124, tâm x 318 · 430 · 542, y 182. */
const SLOT_XS = [318, 430, 542] as const;
const SLOT_Y = 182;
const SLOT = { w: 100, h: 124 } as const;
const SHADOW_SCALE = 0.44;
/** Câu 1: bóng ấm đúng ở thẻ giữa; câu 2: bóng cá xoay 90° ở thẻ trái. */
const PICK_1: Point = [SLOT_XS[1], SLOT_Y];
const PICK_2: Point = [SLOT_XS[0], SLOT_Y];

/**
 * Kịch bản Bóng của ai (CR-021, T = 5.000 ms): câu 1 ấm trà, ba bóng (ấm mất vòi, ấm đúng, xương
 * rồng) → chạm bóng đúng → ✓; câu 2 con cá, bóng đúng nằm xoay 90° cạnh bóng cá mất đuôi → chạm →
 * ✓, rồi bóng xoay về thẳng đứng để thấy vẫn khớp.
 */
export const SHADOW_MATCH_SCRIPT = defineScript({
  id: "shm",
  T: 5000,
  steps: [0, 1000, 2000],
  hand: {
    moves: [
      [500, 500, PICK_1],
      [1750, 450, PICK_2],
      [3000, 400, null],
    ],
    taps: [1100, 2450],
  },
  tracks: {
    m1: track().to(400, 200, { s: 1.05 }, "glide").to(600, 200, { s: 1 }, "glide"),
    q1: questionOut(1800),
    q2: questionIn(2000),
    p1: track().bump(1160, 1.08, 180),
    ring1: popIn(1160),
    ok1: popIn(1220),
    rp1: ripple(1100),
    p2: track().bump(2510, 1.08, 180),
    ring2: popIn(2510),
    ok2: popIn(2570),
    rp2: ripple(2450),
    // Bóng đúng của câu 2 xoay ngược 90° về thẳng như cá trên thẻ đề.
    turn: popIn(2700),
    up2: track().to(2800, 400, { r: -90 }, "glide"),
  },
});

/** Vòng khoanh quanh thẻ bóng: lề 7 quanh thẻ, góc 18. */
const RING = { w: SLOT.w + 14, h: SLOT.h + 14, rx: 18 } as const;

/** Hình minh hoạ động Bóng của ai (màn Hướng dẫn); khung tĩnh = `ShadowMatchHowTo`. */
export function ShadowMatchDemo(props: DemoProps) {
  return (
    <DemoStage
      script={SHADOW_MATCH_SCRIPT}
      still={ShadowMatchHowTo}
      {...props}
      backdrop={
        <>
          {/* Thẻ đề: giấy, viền mực, viền trong cam Nhận diện */}
          <rect
            x={MODEL.x}
            y={MODEL.y}
            width={MODEL.w}
            height={MODEL.h}
            rx={16}
            className="fill-paper stroke-ink filter-[url(#chalk)]"
            strokeWidth={4}
          />
          <rect
            x={MODEL.x + 8}
            y={MODEL.y + 8}
            width={MODEL.w - 16}
            height={MODEL.h - 16}
            rx={11}
            fill="none"
            className="stroke-identify"
            strokeWidth={4}
          />
          <ellipse cx={145} cy={244} rx={50} ry={7} className="fill-ink" opacity={0.12} />
          {/* Mũi tên phấn sang các bóng */}
          <g
            fill="none"
            className="stroke-chalk filter-[url(#chalk)]"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M232 182 C242 175 252 175 260 182" />
            <path d="M251 173 L261 182 L251 191" />
          </g>
          {SLOT_XS.map((x) => (
            <ChalkCard key={x} x={x - SLOT.w / 2} y={SLOT_Y - SLOT.h / 2} w={SLOT.w} h={SLOT.h} />
          ))}
        </>
      }
    >
      {/* Câu 1: ấm trà; bóng ấm mất vòi · ấm đúng · xương rồng */}
      <Question k="q1">
        <A k="m1" x={MODEL_AT[0]} y={MODEL_AT[1]}>
          <ColoredItem item="teapot" x={0} y={0} scale={0.78} />
        </A>
        <Shadow item="teapot" variant={1} x={SLOT_XS[0]} y={SLOT_Y} scale={SHADOW_SCALE} />
        <A k="p1" x={PICK_1[0]} y={PICK_1[1]}>
          <Shadow item="teapot" variant={0} x={0} y={0} scale={SHADOW_SCALE} />
        </A>
        <Shadow item="cactus" variant={0} x={SLOT_XS[2]} y={SLOT_Y} scale={SHADOW_SCALE} />
        <RectRing k="ring1" x={PICK_1[0]} y={PICK_1[1]} {...RING} />
        <Mark k="ok1" x={PICK_1[0] + 50} y={PICK_1[1] - 62} kind="ok" />
      </Question>

      {/* Câu 2: con cá; bóng cá xoay 90° (đúng) · cá mất đuôi · mèo */}
      <Question k="q2">
        <ColoredItem item="fish" x={MODEL_AT[0]} y={MODEL_AT[1]} scale={0.7} />
        <A k="p2" x={PICK_2[0]} y={PICK_2[1]}>
          <A k="up2">
            <Shadow item="fish" variant={0} x={0} y={0} scale={SHADOW_SCALE} rotate={90} />
          </A>
        </A>
        <Shadow item="fish" variant={1} x={SLOT_XS[1]} y={SLOT_Y} scale={SHADOW_SCALE} />
        <Shadow item="cat" variant={0} x={SLOT_XS[2]} y={SLOT_Y} scale={SHADOW_SCALE} />
        <RectRing k="ring2" x={PICK_2[0]} y={PICK_2[1]} {...RING} />
        <Mark k="ok2" x={PICK_2[0] + 50} y={PICK_2[1] - 62} kind="ok" />
        {/* Mũi tên ↻ (xoay) */}
        <IconBadge k="turn" x={PICK_2[0]} y={SLOT_Y + SLOT.h / 2 + 30} r={18}>
          <g strokeWidth={2.6} transform="scale(0.8) scale(-1 1)">
            <path d="M-12 -6 A13 13 0 1 1 -6 12" />
            <path d="M-0.3 9.3 L-9.6 10.2 L-4.7 18.3" />
          </g>
        </IconBadge>
      </Question>
      <Ripple k="rp1" x={PICK_1[0]} y={PICK_1[1]} />
      <Ripple k="rp2" x={PICK_2[0]} y={PICK_2[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
