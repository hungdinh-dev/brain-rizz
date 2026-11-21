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
  type TrackBuilder,
  track,
} from "../_shared/demo";
import { EYE_PATH } from "../_shared/icons";
import type { DemoProps } from "../types";
import { CupShuffleHowTo } from "./CupShuffleHowTo";
import {
  CHALK_CAP_PATH,
  CHALK_PATH,
  CHALK_SIZE,
  cupBandPath,
  cupBodyPath,
  cupRimPath,
} from "./shapes";

/** Ba cốc 70 × 86, đáy trên vạch bàn y 258, tâm x 220 · 320 · 420 (bước 100). */
const CUP_W = 70;
const CUP_H = 86;
const BASE_Y = 258;
const STEP = 100;
const HOME = { A: 220, B: 320, C: 420 } as const;
const LIFT = 56;
const CUP_BODY = cupBodyPath(CUP_W, CUP_H);
const CUP_BAND = cupBandPath(CUP_W, CUP_H);
const CUP_RIM = cupRimPath(CUP_W, CUP_H);

/** Ba lượt tráo: [mốc, thời lượng]. Cốc B (úp phấn) đi cung trên, cốc kia cung dưới. */
const SWAP_1 = [1350, 450] as const; // B giữa → phải, C phải → giữa
const SWAP_2 = [1900, 450] as const; // A trái → giữa, C giữa → trái
const SWAP_3 = [2450, 500] as const; // B phải → trái, C trái → phải
const TAP = 3550;
/** Cốc B nằm ở chỗ trái khi hết tráo. */
const FINAL_B = HOME.A;

/** Cung tráo: lên (âm) hoặc xuống (dương) `h` ở nửa đầu, về vạch bàn ở nửa sau. */
function arc(t: TrackBuilder, [at, dur]: readonly [number, number], h: number): TrackBuilder {
  return t.to(at, dur / 2, { y: h }, "settle").to(at + dur / 2, dur / 2, { y: 0 }, "glide");
}

/**
 * Kịch bản Tráo cốc (CR-021, T = 5.400 ms): mắt + cốc giữa nhấc lên thấy cục phấn rồi úp xuống →
 * ba lượt tráo (cốc có phấn đi cung trên, cốc kia cung dưới) → chạm cốc trái → cốc nhấc lên lộ phấn
 * → ✓.
 */
export const CUP_SHUFFLE_SCRIPT = defineScript({
  id: "cs",
  T: 5400,
  steps: [0, 1300, 3000],
  hand: {
    moves: [
      [3000, 450, [FINAL_B, BASE_Y - 34]],
      [3950, 400, null],
    ],
    taps: [TAP],
  },
  tracks: {
    eye: popIn(150).fade(1300, 150, 0),
    lift: track()
      .to(300, 250, { y: -LIFT })
      .to(1000, 250, { y: 0 }, "glide")
      .to(TAP + 60, 200, { y: -LIFT }),
    Bx: track()
      .to(SWAP_1[0], SWAP_1[1], { x: STEP }, "glide")
      .to(SWAP_3[0], SWAP_3[1], { x: -STEP }, "glide"),
    By: arc(arc(track(), SWAP_1, -40), SWAP_3, -48),
    Ax: track().to(SWAP_2[0], SWAP_2[1], { x: STEP }, "glide"),
    Ay: arc(track(), SWAP_2, -40),
    Cx: track()
      .to(SWAP_1[0], SWAP_1[1], { x: -STEP }, "glide")
      .to(SWAP_2[0], SWAP_2[1], { x: -2 * STEP }, "glide")
      .to(SWAP_3[0], SWAP_3[1], { x: 0 }, "glide"),
    Cy: arc(arc(arc(track(), SWAP_1, 14), SWAP_2, 14), SWAP_3, 14),
    ring: popIn(TAP + 260),
    ok: popIn(TAP + 320),
    rp: ripple(TAP),
  },
});

/** Cốc úp (nét trơn), gốc ở giữa mép dưới; thân nền bảng che vật phía sau. */
function Cup() {
  return (
    <g strokeLinejoin="round">
      <path d={CUP_BODY} className="fill-board" />
      <path d={CUP_BAND} className="fill-identify" />
      <path d={CUP_BODY} className="fill-none stroke-chalk" strokeWidth={3.5} />
      <path d={CUP_RIM} className="fill-board stroke-chalk" strokeWidth={3.5} />
    </g>
  );
}

/** Cục phấn nằm trên bàn, đáy ở gốc. */
function Chalk() {
  return (
    <g transform={`scale(${52 / CHALK_SIZE.w})`}>
      <path d={CHALK_PATH} className="fill-chalk stroke-ink" strokeWidth={3} />
      <path
        d={CHALK_CAP_PATH}
        className="fill-none stroke-ink"
        strokeOpacity={0.45}
        strokeWidth={3}
      />
    </g>
  );
}

/** Hình minh hoạ động Tráo cốc (màn Hướng dẫn); khung tĩnh = `CupShuffleHowTo`. */
export function CupShuffleDemo(props: DemoProps) {
  return (
    <DemoStage
      script={CUP_SHUFFLE_SCRIPT}
      still={CupShuffleHowTo}
      {...props}
      backdrop={
        <path
          d={`M150 ${BASE_Y + 6} L490 ${BASE_Y + 6}`}
          className="stroke-chalk/60 filter-[url(#chalk)]"
          strokeWidth={3}
          strokeLinecap="round"
        />
      }
    >
      {/* Mắt: pha xem cục phấn */}
      <A k="eye" x={320} y={78}>
        <g fill="none" className="stroke-chalk" strokeLinejoin="round">
          <path d={EYE_PATH} transform="scale(0.8)" strokeWidth={5} />
          <circle r={11} strokeWidth={4} />
        </g>
        <circle r={4.5} className="fill-identify" />
      </A>

      <A k="Ax" x={HOME.A} y={BASE_Y}>
        <A k="Ay">
          <Cup />
        </A>
      </A>
      <A k="Cx" x={HOME.C} y={BASE_Y}>
        <A k="Cy">
          <Cup />
        </A>
      </A>
      {/* Cốc B úp cục phấn: phấn đi theo cốc khi tráo, nằm yên khi cốc nhấc lên */}
      <A k="Bx" x={HOME.B} y={BASE_Y}>
        <A k="By">
          <Chalk />
          <A k="lift">
            <Cup />
          </A>
        </A>
      </A>

      <Ring k="ring" x={FINAL_B} y={BASE_Y - 10} rx={52} ry={34} />
      <Mark k="ok" x={FINAL_B + 54} y={BASE_Y - 104} kind="ok" />
      <Ripple k="rp" x={FINAL_B} y={BASE_Y - 34} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
