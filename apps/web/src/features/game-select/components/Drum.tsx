import { GAMES, type GameId } from "@brain-rizz/shared";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { useReducedMotion } from "@/features/motion";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { DRUM_BAND_MAX_BLUR, DRUM_BAND_ROWS, drumRows } from "../drum";
import { useDrumFrame } from "../hooks/use-wheel-spin";
import { GameThumb } from "./GameThumb";

/**
 * Thông số theo ui-ux 6.7 (máy tính / điện thoại). Viết sẵn từng class để Tailwind sinh ra được.
 * Dòng ở dải chọn lệch vào trong đúng bằng `lề dòng − lề dải − viền dải` (36 − 24 − 4 = 8,
 * 28 − 16 − 3,5 = 8,5) nên chồng khít lên dòng của lớp dưới.
 */
const GEOMETRY = {
  wide: {
    rowHeight: 64,
    frame: "h-[clamp(330px,calc(100dvh_-_300px),420px)] rounded-[28px] border-4 shadow-sticker",
    row: "inset-x-9 h-16",
    bandRow: "inset-x-2 h-16",
    gap: "gap-3.5",
    thumb: "h-11.5 w-18 rounded-xl border-[3px]",
    name: "text-2xl",
    chip: "",
    band: "inset-x-6 h-18.5 rounded-[18px] border-4",
    pointer: "w-5.25 h-6.75",
  },
  compact: {
    rowHeight: 52,
    frame: "h-82.5 rounded-3xl border-[3.5px] shadow-sticker",
    row: "inset-x-7 h-13",
    bandRow: "inset-x-[8.5px] h-13",
    gap: "gap-2.5",
    thumb: "h-8.5 w-13.5 rounded-[9px] border-[2.5px]",
    name: "text-lg",
    chip: "h-5.5 px-2 text-[11.5px]",
    band: "inset-x-4 h-15.5 rounded-[15px] border-[3.5px]",
    pointer: "w-4.25 h-5.5",
  },
} as const;

type Geometry = (typeof GEOMETRY)[keyof typeof GEOMETRY];

interface DrumProps {
  /** Game trên trống, đúng thứ tự `wheelSlices(party)`. */
  slices: readonly GameId[];
  /** Vị trí game server chọn trong `slices` (chưa quay thì bỏ qua). */
  target: number;
  /** Giờ server bắt đầu quay (0 = chưa quay) và thời gian quay. */
  spinAt: number;
  spinMs: number;
  /** Bản điện thoại: dòng 52 px, khung 330 px. */
  compact?: boolean;
  className?: string;
}

/**
 * Trống quay dọc kiểu bộ chọn giờ (CR-017, khu 24): cuộn vô hạn, mỗi dòng một game (ảnh, tên,
 * nhóm kỹ năng), cong theo trụ bằng `rotateX` + phối cảnh, mờ dần về mép. Dải chọn ở giữa là lớp
 * thứ hai chép các dòng gần tâm (chữ màu thẻ) nên dòng đổi màu đúng mép dải. Chỉ CSS transform,
 * không canvas (bất biến 4). Vị trí tính mỗi khung hình trong component này, màn không vẽ lại.
 */
export function Drum({ slices, target, spinAt, spinMs, compact = false, className }: DrumProps) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const reduced = useReducedMotion();
  const g = compact ? GEOMETRY.compact : GEOMETRY.wide;
  const frame = useDrumFrame({ spinAt, spinMs, count: slices.length, target });
  const landed = frame.phase === "landed";
  const rows = drumRows(frame.pos, slices.length, g.rowHeight);
  const bandBlur = Math.min(frame.blur, DRUM_BAND_MAX_BLUR);
  const pop = landed && !reduced;
  // Trống vẽ lại mỗi khung hình: nhãn trợ năng (đủ tên trò) chỉ tính lại khi danh sách đổi.
  const key = slices.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` đại diện cho `slices`
  const label = useMemo(
    () =>
      t("gameSelect.wheelLabel", {
        count: slices.length,
        games: slices.map((id) => text(id).title).join(", "),
      }),
    [key, t, text],
  );

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden border-sticker bg-board text-chalk",
        g.frame,
        className,
      )}
    >
      <div className="absolute inset-0 bg-board-shade" />
      <div
        className="absolute inset-0 perspective-[900px]"
        style={frame.blur > 0 ? { filter: `blur(${frame.blur}px)` } : undefined}
      >
        {rows.map((r) => (
          <div
            key={r.key}
            className={cn("absolute top-1/2 flex items-center", g.row, g.gap)}
            // Vị trí, góc, độ mờ đổi theo từng khung hình nên phải gán inline.
            style={{
              transform: `translateY(calc(${r.y}px - 50%)) rotateX(${-r.deg}deg)`,
              opacity: r.opacity,
            }}
          >
            <DrumRowContent id={slices[r.index]!} g={g} chalk />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 drum-shade" />
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 overflow-hidden border-sticker shadow-sticker-sm transition-[background-color,color] duration-200",
          g.band,
          landed ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
          pop && "fx-drum-glow",
        )}
      >
        <div
          className="absolute inset-0"
          style={bandBlur > 0 ? { filter: `blur(${bandBlur}px)` } : undefined}
        >
          {rows
            .filter((r) => Math.abs(r.d) < DRUM_BAND_ROWS)
            .map((r) => (
              <div
                key={r.key}
                className={cn("absolute top-1/2", g.bandRow)}
                style={{ transform: `translateY(calc(${r.y}px - 50%))` }}
              >
                <span
                  className={cn(
                    "flex size-full items-center",
                    g.gap,
                    pop && Math.abs(r.d) < 0.5 && "fx-drum-pop",
                  )}
                >
                  <DrumRowContent id={slices[r.index]!} g={g} />
                </span>
              </div>
            ))}
        </div>
      </div>
      <Pointer side="left" g={g} nudge={pop} />
      <Pointer side="right" g={g} nudge={pop} />
    </div>
  );
}

/**
 * Nội dung một dòng: ảnh game, tên (cắt "…"), nhãn nhóm (không co). Không đổi theo khung hình nên
 * `memo` giữ nguyên, chỉ khung bọc ngoài (vị trí, góc) vẽ lại.
 */
const DrumRowContent = memo(function DrumRowContent({
  id,
  g,
  chalk,
}: {
  id: GameId;
  g: Geometry;
  /** Lớp dưới (chữ phấn); lớp trong dải chọn để chữ theo màu dải. */
  chalk?: boolean;
}) {
  const text = useGameTextLookup();
  const category = GAMES[id].category;
  return (
    <>
      <GameThumb id={id} category={category} className={g.thumb} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-display leading-[1.1] font-extrabold",
          g.name,
          chalk && "text-chalk",
        )}
      >
        {text(id).title}
      </span>
      <CategoryChip category={category} className={g.chip} />
    </>
  );
});

/** Kim tam giác vàng sát mép trái/phải, trỏ vào dải chọn; lúc trúng giật vào 5 px rồi về. */
function Pointer({ side, g, nudge }: { side: "left" | "right"; g: Geometry; nudge: boolean }) {
  const left = side === "left";
  return (
    <span
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2",
        left ? "left-0.75 [--drum-nudge:5px]" : "right-0.75 [--drum-nudge:-5px]",
      )}
    >
      <svg aria-hidden viewBox="0 0 22 28" className={cn(g.pointer, nudge && "fx-drum-nudge")}>
        <path
          d={left ? "M3 3 L19 14 L3 25 Z" : "M19 3 L3 14 L19 25 Z"}
          className="fill-primary stroke-sticker"
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
