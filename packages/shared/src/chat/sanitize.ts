import { CHAT_MAX_LENGTH } from "./constants";
import { filterProfanity } from "./profanity";

/**
 * Ký tự vô hình bị xoá: ký tự điều khiển, zero-width space/non-joiner, word joiner, BOM,
 * soft hyphen, ký tự đổi chiều chữ (bidi override). Giữ ZWJ (U+200D) và variation selector
 * vì emoji ghép cần chúng.
 */
const INVISIBLE = /[\p{Cc}­​‌‎‏⁠﻿‪-‮⁦-⁩]/gu;

/** Cắt còn tối đa `max` code point (không cắt đôi cặp surrogate của emoji). */
export function truncateCodePoints(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("");
}

/**
 * Làm sạch một tin chữ trước khi phát (server gọi, web có thể gọi để xem trước):
 * NFC, xuống dòng/tab → khoảng trắng, xoá ký tự vô hình, gộp khoảng trắng, trim,
 * cắt `CHAT_MAX_LENGTH` code point, rồi lọc từ tục. Trả `null` nếu không còn gì để gửi.
 */
export function sanitizeChatText(raw: string): string | null {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[\t\n\v\f\r]/g, " ")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (cleaned === "") return null;
  const cut = truncateCodePoints(cleaned, CHAT_MAX_LENGTH).trimEnd();
  // `***` có thể dài hơn đoạn bị che ("dm" → "***"), nên cắt lại sau khi lọc.
  const filtered = truncateCodePoints(filterProfanity(cut), CHAT_MAX_LENGTH).trim();
  return filtered === "" ? null : filtered;
}
