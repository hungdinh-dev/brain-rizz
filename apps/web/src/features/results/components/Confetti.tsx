import { cn } from "@/lib/utils";

const COLORS = ["bg-sun", "bg-pink", "bg-sky", "bg-mint", "bg-grape", "bg-identify"] as const;
const PIECES = 24;

/**
 * Pháo giấy rơi phủ cả màn (chỉ trang trí, không bắt chạm). Dùng hoạt ảnh `.fx-drop`
 * trong styles/characters.css nên tự tắt khi người dùng bật "giảm chuyển động".
 */
export function Confetti({ className }: { className?: string }) {
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
          // Vị trí và nhịp rơi rải đều theo chỉ số (tất định, không cần random).
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${((i * 0.53) % 3).toFixed(2)}s`,
            animationDuration: `${3 + ((i * 0.37) % 1.6)}s`,
          }}
        />
      ))}
    </div>
  );
}
