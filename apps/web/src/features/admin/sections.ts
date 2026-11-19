import {
  ChartColumnIcon,
  DoorOpenIcon,
  Gamepad2Icon,
  LogInIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";
import { type AdminSection, isAdminSection } from "@/stores/nav.store";

/**
 * 8 mục của trang quản trị (ui-ux 6.9), theo thứ tự menu. Danh sách nằm ở nav.store vì cũng là
 * `<mục>` trong đường dẫn `/admin/<mục>` (CR-022).
 */
export { ADMIN_SECTIONS, type AdminSection, isAdminSection } from "@/stores/nav.store";

export const SECTION_ICON: Record<AdminSection, LucideIcon> = {
  overview: ChartColumnIcon,
  games: Gamepad2Icon,
  scoring: SlidersHorizontalIcon,
  logins: LogInIcon,
  players: UsersIcon,
  matches: TrophyIcon,
  rooms: DoorOpenIcon,
  admins: ShieldCheckIcon,
};

/** Mục mở lần trước trên máy này (chỉ cho tiện, không bắt buộc). */
export function loadLastSection(): AdminSection {
  const saved = safeLocal.get(STORAGE_KEYS.adminSection);
  return isAdminSection(saved) ? saved : "overview";
}

export function saveLastSection(section: AdminSection) {
  safeLocal.set(STORAGE_KEYS.adminSection, section);
}
