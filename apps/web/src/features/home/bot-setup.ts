import {
  AVATAR_COLORS,
  type BotLevel,
  CHARACTER_IDS,
  type CharacterId,
  MAX_PLAYERS,
  type RoomBotsOption,
} from "@brain-rizz/shared";

/**
 * Hộp thoại "Chơi với máy" (CR-016, ui-ux 6.6): số bot và một mức chung cho cả phòng.
 * Hàm thuần, có test (`bot-setup.test.ts`).
 */

/** Ít nhất 1 bot; nhiều nhất là mọi ghế còn lại trừ ghế của mình. */
export const BOT_COUNT_MIN = 1;
export const BOT_COUNT_MAX = MAX_PLAYERS - 1;

/** Mặc định: 3 bot mức Vừa (chủ dự án duyệt, bot-players.md mục 2). */
export const DEFAULT_BOT_SETUP: Readonly<RoomBotsOption> = { count: 3, level: 1 };

/** Số bot trong khoảng cho phép (nút −/+ chạm biên thì khoá, hàm này phòng giá trị lạ). */
export function clampBotCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_BOT_SETUP.count;
  return Math.min(BOT_COUNT_MAX, Math.max(BOT_COUNT_MIN, Math.round(count)));
}

/** Tùy chọn `bots` gửi kèm khi tạo phòng (`CreateOptions` của giao thức). */
export function toBotsOption(count: number, level: BotLevel): RoomBotsOption {
  return { count: clampBotCount(count), level };
}

/** Số ghế còn lại cho bạn bè sau khi có mình và `count` bot. */
export function freeSeats(count: number): number {
  return Math.max(0, MAX_PLAYERS - 1 - clampBotCount(count));
}

export interface SeatFace {
  avatar: CharacterId;
  colorIndex: number;
}

/**
 * Nhân vật minh hoạ cho dải ghế của hộp thoại (trang trí): bot lấy lần lượt các nhân vật khác
 * nhân vật của mình, màu khác màu của mình. Bot thật do server chọn lúc tạo phòng.
 */
export function previewBotFaces(me: SeatFace, count: number): SeatFace[] {
  const avatars = CHARACTER_IDS.filter((id) => id !== me.avatar);
  const colors = AVATAR_COLORS.map((_, i) => i).filter((i) => i !== me.colorIndex);
  return Array.from({ length: clampBotCount(count) }, (_, i) => ({
    avatar: avatars[i % avatars.length] ?? me.avatar,
    colorIndex: colors[i % colors.length] ?? 0,
  }));
}
