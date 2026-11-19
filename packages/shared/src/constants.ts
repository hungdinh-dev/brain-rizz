/** Tên room đăng ký trên Colyseus server. */
export const ROOM_NAME = "party" as const;
/** Tên room Kiểm tra não (UC-14, ADR 0011): phòng solo, tạo bằng `client.create`, không có mã phòng. */
export const BRAIN_TEST_ROOM_NAME = "brain-test" as const;
/** Độ dài tối đa của `accessToken` (JWT Supabase) trong join options; dài hơn thì bị bỏ qua như không gửi. */
export const MAX_ACCESS_TOKEN_LENGTH = 4_096;
/**
 * Phòng Kiểm tra não: ở màn hướng dẫn (pha `intro`) quá ngần này ms mà chưa bấm Sẵn sàng thì
 * server huỷ lượt (không lưu) và đóng phòng, để máy chủ không bị giữ thức vô ích.
 */
export const BRAIN_TEST_INTRO_IDLE_MS = 5 * 60_000;
/** Mã đóng kết nối (WebSocket close code) khi phòng Kiểm tra não bị đóng vì chờ quá lâu ở `intro`. */
export const BRAIN_TEST_IDLE_CLOSE_CODE = 4_100;

/**
 * Tổng số minigame theo kế hoạch (FR-MG-05, CR-014), kể cả game chưa có code. Bằng số dòng của
 * `CATALOG` ở màn Chọn game (test `catalog.test.ts` kiểm) và bảng docs/04-minigames/README.md.
 */
export const PLANNED_GAME_COUNT = 31;

/** Số ghế tối đa một phòng party, tính cả bot (CR-018). */
export const MAX_PLAYERS = 12;
/** Số người tối thiểu để chủ phòng bắt đầu trận (FR-PH-11). */
export const MIN_PLAYERS_TO_START = 2;

/** Thời gian đếm ngược trước mỗi vòng (ms) — FR-VC-02. */
export const COUNTDOWN_MS = 5_000;
/** Màn hướng dẫn (pha `game-intro`): hết ngần này ms thì server tự bắt đầu vòng (FR-VC-19). */
export const INTRO_AUTO_START_MS = 20_000;
/** Vòng quay bắt đầu quay sau ngần này ms kể từ lúc server chọn kết quả, để mọi máy kịp nhận. */
export const WHEEL_SPIN_LEAD_MS = 300;
/** Thời lượng hiệu ứng vòng quay (ms) — FR-VC-14. */
export const WHEEL_SPIN_MS = 4_000;
/** Giữ kết quả vòng quay trên màn hình ngần này ms rồi mới sang màn hướng dẫn. */
export const WHEEL_RESULT_HOLD_MS = 1_500;
/** Chủ phòng nhắc độ khó cùng một người tối đa 1 lần trong ngần này ms (FR-VC-18). */
export const NUDGE_COOLDOWN_MS = 10_000;
/** Dung sai cho đáp án đến muộn do độ trễ mạng (ms). */
export const LATE_ANSWER_GRACE_MS = 400;
/** Khoá thao tác sau khi trả lời sai (ms) — chống bấm bừa. */
export const WRONG_ANSWER_LOCK_MS = 1_500;
/** Giữ chỗ cho người chơi bị rớt mạng (giây). */
export const RECONNECT_WINDOW_S = 45;
/** Giới hạn số đáp án mỗi giây của một người. */
export const MAX_ANSWERS_PER_SECOND = 10;

/**
 * Bot (CR-016, docs/01-product/bot-players.md): thời gian giải ước lượng (ms) cho game chưa khai
 * báo `expectedSolveMs`, trước khi nhân hệ số độ khó của game và cộng miễn trừ. Bằng trung vị của
 * (thời gian một câu ở Thường − miễn trừ) trên các game đã khai báo.
 */
export const BOT_BASE_SOLVE_MS = 2_800;
/**
 * Bot: tỉ lệ đúng của "người chơi chuẩn" (người lớn chọn đúng sức) ở game chưa khai báo
 * `expectedAccuracy`. Cũng là mốc của bảng mức bot: `BOT_LEVEL_SPECS[mức].accuracy` là tỉ lệ đúng
 * của bot ở game có tỉ lệ chuẩn đúng bằng số này (`relativeAccuracy`, `src/bots/levels.ts`).
 */
export const BOT_BASE_ACCURACY = 0.9;
/**
 * Bot: trần của tỉ lệ đúng chuẩn `A` (`expectedAccuracy` của game) TRƯỚC khi nhân hệ số sai trong
 * `relativeAccuracy`. Với `A` = 1 (game không có cách sai) thì 1 − A = 0, hệ số sai mất tác dụng:
 * mọi mức bot cùng chạm trần `BOT_MAX_ACCURACY`, bot Dễ đúng như bot Siêu. Kẹp `A` ở 98 % giữ bot
 * Dễ sai ít nhất 4,4 % và bot Siêu 1,6 % ở mọi game. Đặc tả game nên khai báo `A` không quá số này.
 */
export const BOT_MAX_BASE_ACCURACY = 0.98;
/** Bot: trần tỉ lệ đúng sau khi quy theo game, để bot (và người mô phỏng) không bao giờ đúng tuyệt đối. */
export const BOT_MAX_ACCURACY = 0.99;
/** Bot: thời gian phản xạ tối thiểu (ms) sau khi hết miễn trừ (trình chiếu) mới được trả lời. */
export const BOT_MIN_REACTION_MS = 600;
/** Bot: bấm "Đã hiểu" ở màn hướng dẫn sau một khoảng ngẫu nhiên trong [min, max] ms. */
export const BOT_INTRO_READY_MS = [1_000, 3_000] as const;
/** Bot: xác suất gửi một biểu cảm ở bảng điểm vòng và vinh danh. */
export const BOT_CHAT_CHANCE = 0.35;
/** Bot: biểu cảm (nếu có) gửi sau một khoảng ngẫu nhiên trong [min, max] ms kể từ đầu pha. */
export const BOT_CHAT_DELAY_MS = [800, 3_000] as const;

export const DEFAULT_TOTAL_ROUNDS = 3;
/** Số vòng chủ phòng được đặt cho một trận (FR-VC-01). */
export const MIN_TOTAL_ROUNDS = 1;
export const MAX_TOTAL_ROUNDS = 10;
export const MAX_NAME_LENGTH = 16;

/**
 * Bảng màu avatar (pastel), người chơi chọn theo index. Đủ `MAX_PLAYERS` màu để mỗi ghế một màu
 * (CR-018); 4 màu cuối là màu tạm, ui-designer duyệt ở bản mẫu phòng 12 người.
 */
export const AVATAR_COLORS = [
  "#7FD1AE",
  "#F7A8B8",
  "#FFD166",
  "#8EC5FF",
  "#C3A6FF",
  "#FF9F6E",
  "#5ED3D8",
  "#B8E07A",
  "#FF8FE9",
  "#FB7B74",
  "#CBAF86",
  "#748EDC",
] as const;

/**
 * Nhân vật đại diện người chơi chọn. Được phép trùng giữa người chơi (màu vẫn là thứ phân biệt).
 * Tên hiển thị nằm ở i18n của web.
 *
 * 6 nhân vật đầu luôn mở (`BASE_CHARACTER_IDS`, bot chỉ dùng các nhân vật này):
 * - khoi: Khói (mèo) · bo: Bơ (chó) · mochi: Mochi (thỏ)
 * - bap: Bắp (gà con) · cam: Cam (cáo) · tron: Tròn (gấu trúc)
 *
 * 6 bạn đồng hành sau khoá tới khi đạt thành tích (CR-024, `PET_CHARACTER_IDS` và `UNLOCK_RULES`
 * trong `cosmetics/unlocks.ts`; server thay bằng nhân vật mặc định nếu chưa mở):
 * - pin: Pin (cánh cụt) · op: Ộp (ếch) · thong: Thông (cú)
 * - gai: Gai (nhím) · may: Mây (koala) · lua: Lửa (rồng con)
 *
 * Giữ thứ tự: 6 cũ trước, 6 mới sau (test `unlocks.test.ts` kiểm bằng `BASE_CHARACTER_IDS` +
 * `PET_CHARACTER_IDS`).
 */
export const CHARACTER_IDS = [
  "khoi",
  "bo",
  "mochi",
  "bap",
  "cam",
  "tron",
  "pin",
  "op",
  "thong",
  "gai",
  "may",
  "lua",
] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === "string" && (CHARACTER_IDS as readonly string[]).includes(v);
}
