import type { Phase } from "../protocol";

/**
 * Luật chat trong phòng party (CR-011). Dùng chung cho server (chặn, cắt, giới hạn tần suất)
 * và web (ẩn/hiện khung chat, đếm ký tự). Không chứa chữ giao diện: web tự map id ra emoji/t().
 */

/** Độ dài tối đa một tin chữ sau khi làm sạch, tính theo code point (emoji 1 code point = 1). */
export const CHAT_MAX_LENGTH = 120;
/**
 * Độ dài tối đa chuỗi thô client được gửi (code unit UTF-16). Rộng hơn `CHAT_MAX_LENGTH` để
 * chuỗi nhiều emoji / khoảng trắng vẫn qua schema; server tự làm sạch rồi cắt còn 120.
 */
export const CHAT_MAX_INPUT_LENGTH = 480;
/** Số tin gần nhất server giữ trong RAM phòng, gửi cho người mới vào / nối lại. */
export const CHAT_HISTORY_SIZE = 30;

/**
 * Giới hạn tần suất mỗi người (token bucket): gửi liền được `burst` tin,
 * sau đó cứ `refillMs` hồi một tin (~1 tin/giây).
 */
export const CHAT_RATE = { burst: 3, refillMs: 1_000 } as const;

/** Pha được chat. Lúc `countdown` và `playing` khung chat ẩn, server từ chối (`bad-phase`). */
export const CHAT_PHASES = [
  "lobby",
  "game-select",
  "game-intro",
  "round-results",
  "podium",
] as const satisfies readonly Phase[];
export type ChatPhase = (typeof CHAT_PHASES)[number];

export function isChatPhase(phase: string): phase is ChatPhase {
  return (CHAT_PHASES as readonly string[]).includes(phase);
}

/**
 * Biểu cảm / câu chọn sẵn bấm một chạm. Web map: laugh 😂, fire 🔥, clap 👏, shock 😱,
 * gg "GG", hurry "Nhanh lên!" (qua t()).
 */
export const CHAT_QUICK_IDS = ["laugh", "fire", "clap", "shock", "gg", "hurry"] as const;
export type ChatQuickId = (typeof CHAT_QUICK_IDS)[number];
