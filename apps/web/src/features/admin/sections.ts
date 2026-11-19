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

/** 8 mục của trang quản trị (ui-ux 6.9), theo thứ tự menu. */
export const ADMIN_SECTIONS = [
  "overview",
  "games",
  "scoring",
  "logins",
  "players",
  "matches",
  "rooms",
  "admins",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

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

export function isAdminSection(value: unknown): value is AdminSection {
  return typeof value === "string" && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

/** Mục mở lần trước trên máy này (chỉ cho tiện, không bắt buộc). */
export function loadLastSection(): AdminSection {
  const saved = safeLocal.get(STORAGE_KEYS.adminSection);
  return isAdminSection(saved) ? saved : "overview";
}

export function saveLastSection(section: AdminSection) {
  safeLocal.set(STORAGE_KEYS.adminSection, section);
}
