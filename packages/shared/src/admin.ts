import type { Phase } from "./protocol";

/**
 * Kiểu dữ liệu HTTP của game server cho trang quản trị (CR-019, docs/01-product/admin-console.md
 * mục 4.2). Mọi endpoint cần `Authorization: Bearer <access token Supabase>` của một quản trị viên
 * (bảng `admins`): thiếu/sai token 401, không phải admin 403, server chưa cấu hình Supabase 503.
 */

/** Một phòng party đang mở. Không có tên người chơi. */
export interface AdminRoomView {
  roomId: string;
  /** Mã phòng 4 ký tự (bằng `roomId`). */
  code: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  /** Game của vòng hiện tại ("" khi chưa chọn). */
  gameId: string;
  /** Số ghế người thật, kể cả người đang rớt mạng được giữ chỗ. */
  humans: number;
  bots: number;
  /** Số người thật đang kết nối. */
  connected: number;
  /** `party_settings.version` phòng đang áp dụng. */
  configVersion: number;
  /** Lúc tạo phòng, ISO 8601. */
  createdAt: string;
}

/** `GET /admin/rooms`. */
export interface AdminRoomsResponse {
  /** Giờ server (ms). */
  serverTime: number;
  /** Số giây tiến trình đã chạy. */
  uptimeS: number;
  /** Mới tạo trước. */
  rooms: AdminRoomView[];
}

/** `POST /admin/config/reload`: version cấu hình party vừa nạp lại. */
export interface AdminConfigReloadResponse {
  version: number;
}

/** Thân lỗi của mọi endpoint admin. */
export interface AdminErrorResponse {
  error: "unauthorized" | "forbidden" | "unavailable" | "internal";
}
