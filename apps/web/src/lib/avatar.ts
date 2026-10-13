import { AVATAR_COLORS } from "@brain-rizz/shared";

/** Màu avatar theo chỉ số người chơi chọn (dùng chung cho DOM và Phaser). */
export function avatarColor(index: number): string {
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
}
