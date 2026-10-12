import { cn } from "@/lib/utils";

const CELLS = 16;
const ODD = 6;
const STEP = 40;
const ORIGIN = 20;

/**
 * Hình minh hoạ Kẻ lạc đàn (màn Hướng dẫn, thẻ game): lưới 4×4 tam giác viết phấn,
 * một ô là hình tròn được khoanh phấn vàng. Đặt trên nền bảng (`bg-board`).
 */
export function OddOneOutHowTo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" aria-hidden className={cn("overflow-visible", className)}>
      <g className="chalk-stroke stroke-chalk" strokeWidth={3}>
        {Array.from({ length: CELLS }, (_, i) => {
          const cx = ORIGIN + (i % 4) * STEP;
          const cy = ORIGIN + Math.floor(i / 4) * STEP;
          // Lưới cố định 16 ô nên dùng chỉ số làm key là an toàn.
          return i === ODD ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: lưới cố định
            <circle key={i} cx={cx} cy={cy} r={10} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: lưới cố định
            <path key={i} d={`M${cx} ${cy - 11} L${cx + 11} ${cy + 9} L${cx - 11} ${cy + 9} Z`} />
          );
        })}
      </g>
      <circle
        cx={ORIGIN + (ODD % 4) * STEP}
        cy={ORIGIN + Math.floor(ODD / 4) * STEP}
        r={18}
        className="chalk-stroke stroke-primary"
        strokeWidth={4}
      />
    </svg>
  );
}
