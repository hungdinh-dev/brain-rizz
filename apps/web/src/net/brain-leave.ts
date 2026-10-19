import { BRAIN_TEST_IDLE_CLOSE_CODE } from "@brain-rizz/shared";

/**
 * Phòng Kiểm tra não đóng (`onLeave`) thì làm gì:
 * - `idle`: server huỷ lượt vì chờ Sẵn sàng quá `BRAIN_TEST_INTRO_IDLE_MS` (close code
 *   `BRAIN_TEST_IDLE_CLOSE_CODE`) → không nối lại, về màn giới thiệu kèm thông báo.
 * - `keep`: mọi trường hợp khác giữ nguyên cách cũ (đã xong lượt thì vẫn xem kết quả; đóng giữa
 *   lượt thì màn Kiểm tra não hiện "Mất kết nối…").
 */
export type BrainLeaveAction = "idle" | "keep";

export function brainLeaveAction(code: number): BrainLeaveAction {
  return code === BRAIN_TEST_IDLE_CLOSE_CODE ? "idle" : "keep";
}
