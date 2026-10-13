import type { Difficulty } from "@brain-rizz/shared";
import type Phaser from "phaser";
import type { ComponentType } from "react";
import type { Language } from "@/i18n/languages";

/**
 * Cầu nối React ↔ scene Phaser. Scene không biết gì về mạng hay store:
 * nó nhận seed + độ khó, tự sinh câu đố từ @brain-rizz/shared và gọi `submit`.
 */
export interface MinigameBridge {
  seed: number;
  round: number;
  difficulty: Difficulty;
  /** Câu bắt đầu (khác 0 khi nối lại giữa vòng). */
  startIndex: number;
  submit(index: number, answer: unknown): void;
  /**
   * Gọi ngay sau `submit` một câu sai. Chờ `answerResult` của câu `index` rồi trả về số ms
   * (đồng hồ máy) còn lại tới `lockedUntil` của server. Trả về 0 khi server không khoá, hoặc khi
   * quá lâu không có kết quả (server bỏ qua câu đó) để scene không bị kẹt.
   * Scene dùng số này cho `this.time.delayedCall`, nên hết khoá cùng lúc với server và huy hiệu
   * khoá của khung. Trong lúc chờ, scene hiện đáp án đúng (CR-006). Promise trả về sau khi scene có
   * thể đã bị huỷ (hết vòng), nên kiểm `this.sys.isActive()` trước khi dùng.
   * Huy hiệu khoá che dải giữa trên cùng thẻ: tới y ≈ 80 trên khung 720×1280 ở điện thoại thường,
   * và tới y ≈ 225 khi thẻ thấp nhất (320 px). Đừng đặt đáp án đúng ở dải này.
   */
  unlockDelay(index: number): Promise<number>;
}

/** Một câu có hai bản theo thiết bị: chạm (màn cảm ứng) và chuột (máy tính). */
export type DeviceText = { touch: string; mouse: string };

/**
 * Chữ hiển thị của một minigame, mỗi ngôn ngữ một bản.
 * Dùng `type` thay vì `interface`: kiểu khoá dịch của i18next không đi sâu vào interface,
 * khi đó `t("odd-one-out.title")` bị báo sai kiểu.
 */
export type GameLocale = {
  title: string;
  /** Một câu hướng dẫn cách chơi (dự phòng lúc đếm ngược trong khung chơi, gợi ý dưới cột trái khi chơi trên máy tính). */
  howTo: string;
  /** Mô tả ngắn một dòng trên thẻ game ở màn Chọn game và đầu màn Hướng dẫn. */
  summary: string;
  /** Cách chơi đúng 3 bước (màn Hướng dẫn). */
  steps: [string, string, string];
  /** Điều khiển theo thiết bị, vd. "Chạm vào hình" / "Click chuột vào hình". */
  controls: DeviceText;
  /** Câu nhắc lớn lúc đếm ngược 5 giây (dùng cho mọi mức không có câu riêng trong `levelHints`). */
  hint: DeviceText;
  /** Mô tả ngắn từng mức độ khó (Mầm → Siêu khó), hiện dưới nút chọn độ khó. */
  levels: [string, string, string, string];
  /**
   * (Tuỳ chọn) Câu nhắc riêng cho mức độ khó đổi luật hoặc có bẫy cần nhớ, vd. Siêu khó chạm ngược.
   * Thay `hint` ở màn đếm ngược, hiện dưới ô chọn độ khó ở màn Hướng dẫn khi chọn mức đó và ở cột
   * trái khi chơi trên máy tính. Mức không khai báo dùng `hint` chung. Lấy câu bằng `levelHint()`.
   */
  levelHints?: Partial<Record<Difficulty, DeviceText>>;
};

/**
 * Phần web của một minigame — mỗi game export một object này từ `src/games/<id>/index.ts`.
 * Logic câu đố KHÔNG nằm ở đây mà ở `packages/shared/src/games/<id>/`.
 */
export interface GameClient {
  /** Scene Phaser, tải lười thành chunk riêng khi vòng chơi bắt đầu. */
  scene: () => Promise<{ default: new () => Phaser.Scene }>;
  locales: Record<Language, GameLocale>;
  /** Hình minh hoạ cách chơi (SVG nhỏ) cho màn Hướng dẫn và thẻ game; không có thì hiện biểu tượng nhóm kỹ năng. */
  Illustration?: ComponentType<{ className?: string }>;
}

/** Kích thước thiết kế (dọc), Phaser scale FIT theo màn hình thật. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
