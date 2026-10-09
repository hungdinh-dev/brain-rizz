/** Tên room đăng ký trên Colyseus server. */
export const ROOM_NAME = "party" as const;

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 1; // để 1 cho dễ test; tăng lên 2 khi phát hành

/** Thời gian đếm ngược trước mỗi vòng (ms). */
export const COUNTDOWN_MS = 3_000;
/** Thời gian xem kết quả vòng trước khi về sảnh chọn game tiếp (ms). */
export const ROUND_RESULTS_MS = 6_000;
/** Dung sai cho đáp án đến muộn do độ trễ mạng (ms). */
export const LATE_ANSWER_GRACE_MS = 400;
/** Khoá thao tác sau khi trả lời sai (ms) — chống bấm bừa. */
export const WRONG_ANSWER_LOCK_MS = 1_500;
/** Giữ chỗ cho người chơi bị rớt mạng (giây). */
export const RECONNECT_WINDOW_S = 45;
/** Giới hạn số đáp án mỗi giây của một người. */
export const MAX_ANSWERS_PER_SECOND = 10;

export const DEFAULT_TOTAL_ROUNDS = 3;
export const MAX_NAME_LENGTH = 16;

/** Bảng màu avatar (pastel), người chơi chọn theo index. */
export const AVATAR_COLORS = [
  "#7FD1AE",
  "#F7A8B8",
  "#FFD166",
  "#8EC5FF",
  "#C3A6FF",
  "#FF9F6E",
  "#5ED3D8",
  "#B8E07A",
] as const;
