import type { Buddy } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import { ART, buddyArt } from "./buddies";

/** Nét phấn sần (filter #chalk khai báo một lần trong <ChalkDefs /> của App). */
const CHALK = {
  fill: "none",
  filter: "url(#chalk)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * Viền phấn quanh bạn đặt trên thẻ phấn (nền bảng tối): một bản tô phấn nét dày nằm dưới. CSS
 * thắng thuộc tính trình bày của SVG nên mọi hình con đổi sang màu phấn; nét không tô giữ nguyên.
 */
const HALO =
  "[&_*]:fill-chalk [&_*]:stroke-chalk [&_*]:[stroke-width:18px] [&_[fill=none]]:fill-none";

const pal = (species: number, hat = 0, held = 0, glasses = 0): Buddy => ({
  species,
  hat,
  held,
  glasses,
});

/** Khói (mèo) đội mũ chóp tiệc, đeo kính tròn. */
const TARGET = pal(0, 1, 0, 1);

/** Lưới 3×3 bên phải: [bạn, cột, hàng]. Ô giữa là đáp án, ô bên phải là mèo mũ chóp không kính. */
const CROWD: readonly (readonly [Buddy, number, number])[] = [
  [pal(1, 3), 0, 0],
  [pal(2, 0, 1), 1, 0],
  [pal(4, 1, 0, 1), 2, 0],
  [pal(3, 0, 0, 2), 0, 1],
  [TARGET, 1, 1],
  [pal(5, 0, 2), 0, 2],
  [pal(0, 2, 0, 1), 1, 2],
  [pal(1, 0, 3, 1), 2, 2],
];
const NEAR_MISS = pal(0, 1);

/** Lưới bên phải: tâm cột / hàng, cỡ hộp mỗi bạn. */
const GRID = { x: 340, y: 118, step: 80, box: 66 } as const;

/** Một bạn đứng giữa (x, chân ở `feet`) trong hộp cạnh `box`; `halo` thêm viền phấn. */
function Pal({
  buddy,
  x,
  feet,
  box,
  halo = false,
}: {
  buddy: Buddy;
  x: number;
  feet: number;
  box: number;
  halo?: boolean;
}) {
  const k = box / ART.size;
  const transform = `translate(${x - box / 2} ${feet - box}) scale(${k}) translate(${-ART.x} ${-ART.y})`;
  return (
    <>
      {halo && (
        <g transform={transform} className={HALO}>
          {buddyArt(buddy)}
        </g>
      )}
      <g transform={transform}>{buddyArt(buddy)}</g>
    </>
  );
}

const cellX = (col: number) => GRID.x + GRID.step * col;
const cellFeet = (row: number) => GRID.y + GRID.step * row + GRID.box / 2 - 2;

/** Ngón tay chạm (đường 24×24). */
const FINGER =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";

/**
 * Hình minh hoạ Tìm bạn (màn Hướng dẫn, thẻ game), theo mục "Màn hướng dẫn" của đặc tả: nửa trái
 * (biểu tượng mắt) là thẻ giấy vẽ Khói đội mũ chóp tiệc, đeo kính tròn; mũi tên phấn; nửa phải
 * (biểu tượng ngón tay) là lưới 3×3 bạn nhỏ trên thẻ phấn, ngón tay chạm đúng con mèo đội mũ chóp
 * đeo kính tròn có vòng vàng; ngay cạnh là con mèo đội mũ chóp nhưng không kính, mờ đi, có dấu X.
 * Đặt trên nền bảng (`bg-board`).
 */
export function CrowdSearchHowTo({ className }: { className?: string }) {
  const [cx, cy] = [cellX(1), GRID.y + GRID.step];
  return (
    <svg viewBox="4 4 552 352" aria-hidden className={cn("overflow-visible", className)}>
      {/* Biểu tượng mắt */}
      <g {...CHALK} className="stroke-chalk">
        <path
          d="M112 44 C121 29 131 25 140 25 C149 25 159 29 168 44 C159 59 149 63 140 63 C131 63 121 59 112 44 Z"
          strokeWidth={4}
        />
        <circle cx={140} cy={44} r={9} strokeWidth={3.5} />
      </g>
      <circle cx={140} cy={44} r={4} className="fill-chalk" />

      {/* Thẻ "tìm người": giấy, viền mực, viền trong cam Nhận diện, bóng sàn, Khói */}
      <rect
        x={58}
        y={92}
        width={164}
        height={190}
        rx={16}
        filter="url(#chalk)"
        className="fill-paper stroke-ink"
        strokeWidth={4}
      />
      <rect
        x={66}
        y={100}
        width={148}
        height={174}
        rx={11}
        fill="none"
        className="stroke-identify"
        strokeWidth={4}
      />
      <ellipse cx={140} cy={262} rx={46} ry={6} className="fill-ink" opacity={0.12} />
      <Pal buddy={TARGET} x={140} feet={264} box={150} />

      {/* Mũi tên phấn sang đám đông */}
      <g {...CHALK} className="stroke-chalk" strokeWidth={5}>
        <path d="M240 186 C254 178 274 178 288 186" />
        <path d="M277 174 L289 186 L277 198" />
      </g>

      {/* Biểu tượng ngón tay */}
      <path
        d={FINGER}
        transform="translate(420 40) scale(1.6) translate(-12.3 -12)"
        filter="url(#chalk)"
        className="stroke-chalk"
        fill="none"
        strokeWidth={2.3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Thẻ phấn với lớp 3×3 */}
      <rect
        x={300}
        y={78}
        width={240}
        height={240}
        rx={14}
        filter="url(#chalk)"
        className="fill-chalk/10 stroke-chalk"
        strokeOpacity={0.85}
        strokeWidth={3}
      />
      {CROWD.map(([buddy, col, row]) => (
        <Pal
          key={`${col}-${row}`}
          buddy={buddy}
          x={cellX(col)}
          feet={cellFeet(row)}
          box={GRID.box}
          halo
        />
      ))}

      {/* Mèo đội mũ chóp nhưng không kính: mờ, dấu X nhỏ */}
      <g opacity={0.4}>
        <Pal buddy={NEAR_MISS} x={cellX(2)} feet={cellFeet(1)} box={GRID.box} halo />
      </g>
      <g transform={`translate(${cellX(2) + 24} ${cy + 22})`} strokeLinecap="round">
        <path d="M-8 -8 L8 8 M8 -8 L-8 8" fill="none" stroke="#ffffff" strokeWidth={8} />
        <path
          d="M-8 -8 L8 8 M8 -8 L-8 8"
          fill="none"
          className="stroke-destructive"
          strokeWidth={4}
        />
      </g>

      {/* Vòng vàng quanh bạn đúng, ngón tay chạm */}
      <circle cx={cx} cy={cy} r={37} fill="none" className="stroke-ink" strokeWidth={9} />
      <circle cx={cx} cy={cy} r={37} fill="none" className="stroke-primary" strokeWidth={4.5} />
      <path
        d={FINGER}
        transform={`translate(${cx + 14} ${cy + 18}) scale(1.9) translate(-11 -3.5)`}
        filter="url(#chalk)"
        className="fill-board stroke-chalk"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
