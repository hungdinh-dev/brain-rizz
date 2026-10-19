import { cn } from "@/lib/utils";

const COLORS = ["bg-sun", "bg-pink", "bg-sky", "bg-mint", "bg-grape", "bg-identify"] as const;
const PIECES = 24;
/** Kiểu `burst`: nửa đầu rơi cùng lúc, nửa sau rơi rải. */
const BURST = PIECES / 2;

/** Giây trễ của mảnh thứ `i` (tất định theo chỉ số, không cần random). */
function delayOf(i: number, burst: boolean): number {
  if (!burst) return (i * 0.53) % 3;
  return i < BURST ? (i % 4) * 0.03 : 0.5 + ((i * 0.53) % 2.5);
}

/**
 * Pháo giấy rơi phủ cả màn (chỉ trang trí, không bắt chạm). Dùng hoạt ảnh `.fx-drop`
 * trong styles/characters.css nên tự tắt khi đang giảm chuyển động (nút Hiệu ứng theo máy và
 * máy báo giảm). `burst`: 12 mảnh bung cùng lúc rồi 12 mảnh rơi rải (lúc lật hạng nhất).
 */
export function Confetti({ className, burst = false }: { className?: string; burst?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: số mảnh cố định
          key={i}
          className={cn(
            "fx-drop absolute -top-4 block rounded-[2px] border-2 border-sticker motion-reduce:hidden",
            COLORS[i % COLORS.length],
            i % 3 === 0 ? "h-2.5 w-4" : "h-4 w-2.5",
          )}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${delayOf(i, burst).toFixed(2)}s`,
            animationDuration: `${3 + ((i * 0.37) % 1.6)}s`,
          }}
        />
      ))}
    </div>
  );
}
