import { CHAT_QUICK_IDS, type ChatQuickId } from "@brain-rizz/shared";

/**
 * Biểu cảm / câu chọn sẵn (CR-011). Server chỉ gửi mã (`quickId`): emoji vẽ thẳng,
 * câu chọn sẵn dịch theo ngôn ngữ của người xem (`chat.quick.<id>`).
 */
const EMOJI = { laugh: "😂", fire: "🔥", clap: "👏", shock: "😱" } as const;

export type QuickEmojiId = keyof typeof EMOJI;
export type QuickPhraseId = Exclude<ChatQuickId, QuickEmojiId>;

export function isQuickEmoji(id: ChatQuickId): id is QuickEmojiId {
  return id in EMOJI;
}

export function quickEmoji(id: QuickEmojiId): string {
  return EMOJI[id];
}

/** Thứ tự hàng biểu cảm: emoji trước, câu chọn sẵn sau. */
export const QUICK_ORDER: readonly ChatQuickId[] = CHAT_QUICK_IDS;
