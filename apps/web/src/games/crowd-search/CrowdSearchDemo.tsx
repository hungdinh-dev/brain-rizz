import type { Buddy } from "@brain-rizz/shared";
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
import { CROWD, CrowdSearchHowTo, NEAR_MISS, Pal, TARGET } from "./CrowdSearchHowTo";

type Point = readonly [x: number, y: number];

/** Thẻ "tìm người" (giấy) bên trái: góc trên trái, cỡ. */
const CARD = { x: 60, y: 92, w: 150, h: 180 } as const;
/** Lớp 3 × 3 trên thẻ phấn bên phải: tâm cột, hàng, cỡ hộp mỗi bạn. */
const GRID = { x: 340, y: 100, step: 80, box: 66 } as const;
const cellAt = (col: number, row: number): Point => [
  GRID.x + GRID.step * col,
  GRID.y + GRID.step * row,
];
/** Bạn đúng ở ô giữa; mèo đội mũ chóp không kính (gần giống) ở ô giữa phải. */
const PICK = cellAt(1, 1);
const MISS = cellAt(2, 1);
/** Kính lúp dò: xuất phát ô trên trái, dừng ở bạn gần giống rồi sang bạn đúng. */
const SCAN_FROM = cellAt(0, 0);

/**
 * Kịch bản Tìm bạn (CR-021, T = 4.800 ms): nhìn mèo đội mũ chóp đeo kính tròn trên thẻ → vòng dò
 * lướt qua lớp, dừng ở mèo đội mũ chóp KHÔNG kính → ✗, mờ đi → sang đúng bạn → chạm → vòng vàng + ✓.
 */
export const CROWD_SEARCH_SCRIPT = defineScript({
  id: "crs",
  T: 4800,
  steps: [0, 1000, 2400],
  hand: {
    moves: [
      [2250, 450, PICK],
      [3300, 400, null],
    ],
    taps: [2800],
  },
  tracks: {
    tg: track().to(350, 200, { s: 1.06 }, "glide").to(550, 200, { s: 1 }, "glide"),
    scan: track({ s: 0.6, o: 0 })
      .pop(1050, 200)
      .to(1300, 350, { x: MISS[0] - SCAN_FROM[0], y: MISS[1] - SCAN_FROM[1] }, "glide")
      .to(2000, 300, { x: PICK[0] - SCAN_FROM[0], y: PICK[1] - SCAN_FROM[1] }, "glide")
      .fade(2350, 150, 0),
    miss: track().fade(1760, 150, 0.4),
    x: popIn(1700),
    pick: track().bump(2860, 1.12, 180),
    ring: popIn(2860),
    ok: popIn(2920),
    rp: ripple(2800),
  },
});

/** Một bạn của lớp vẽ quanh tâm ô 0,0, có viền phấn. */
function CrowdPal({ buddy }: { buddy: Buddy }) {
  return <Pal buddy={buddy} x={0} feet={GRID.box / 2 - 2} box={GRID.box} halo />;
}

/** Hình minh hoạ động Tìm bạn (màn Hướng dẫn); khung tĩnh = `CrowdSearchHowTo`. */
export function CrowdSearchDemo(props: DemoProps) {
  return (
    <DemoStage
      script={CROWD_SEARCH_SCRIPT}
      still={CrowdSearchHowTo}
      {...props}
      backdrop={
        <>
          {/* Thẻ "tìm người": giấy, viền mực, viền trong cam Nhận diện */}
          <rect
            x={CARD.x}
            y={CARD.y}
            width={CARD.w}
            height={CARD.h}
            rx={16}
            className="fill-paper stroke-ink filter-[url(#chalk)]"
            strokeWidth={4}
          />
          <rect
            x={CARD.x + 8}
            y={CARD.y + 8}
            width={CARD.w - 16}
            height={CARD.h - 16}
            rx={11}
            fill="none"
            className="stroke-identify"
            strokeWidth={4}
          />
          <ellipse cx={135} cy={252} rx={42} ry={6} className="fill-ink" opacity={0.12} />
          {/* Mũi tên phấn sang lớp */}
          <g
            fill="none"
            className="stroke-chalk filter-[url(#chalk)]"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M226 182 C240 175 256 175 270 182" />
            <path d="M261 173 L271 182 L261 191" />
          </g>
          {/* Thẻ phấn của lớp */}
          <rect
            x={GRID.x - 40}
            y={GRID.y - 40}
            width={240}
            height={240}
            rx={14}
            className="fill-chalk/10 stroke-chalk filter-[url(#chalk)]"
            strokeOpacity={0.85}
            strokeWidth={3}
          />
        </>
      }
    >
      <A k="tg" x={135} y={182}>
        <Pal buddy={TARGET} x={0} feet={72} box={136} />
      </A>

      {CROWD.map(([buddy, col, row]) => {
        const [x, y] = cellAt(col, row);
        return (
          <g key={`${col}-${row}`} transform={`translate(${x} ${y})`}>
            {x === PICK[0] && y === PICK[1] ? (
              <A k="pick">
                <CrowdPal buddy={buddy} />
              </A>
            ) : (
              <CrowdPal buddy={buddy} />
            )}
          </g>
        );
      })}
      <A k="miss" x={MISS[0]} y={MISS[1]}>
        <CrowdPal buddy={NEAR_MISS} />
      </A>

      {/* Vòng dò nét đứt */}
      <A k="scan" x={SCAN_FROM[0]} y={SCAN_FROM[1]}>
        <circle r={37} fill="none" className="stroke-ink" strokeWidth={8} />
        <circle r={37} fill="none" className="stroke-chalk" strokeWidth={4} strokeDasharray="9 6" />
      </A>
      <Mark k="x" x={MISS[0] + 26} y={MISS[1] + 26} kind="bad" />

      <Ring k="ring" x={PICK[0]} y={PICK[1]} rx={37} />
      <Mark k="ok" x={PICK[0] + 34} y={PICK[1] - 36} kind="ok" />
      <Ripple k="rp" x={PICK[0]} y={PICK[1]} />
      <Cursor />
      <StepBadge />
    </DemoStage>
  );
}
