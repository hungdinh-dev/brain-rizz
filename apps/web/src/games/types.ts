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
  /**
   * Chờ `answerResult` của câu `index` (gọi ngay sau `submit`). Trả về đúng/sai theo server và số
   * ms (đồng hồ máy) còn khoá; `null` khi quá lâu không có kết quả (server bỏ qua câu đó). Dùng cho
   * game đi tiếp ngay khi máy thấy đúng nhưng server vẫn có thể chấm sai, vd. hạn trả lời
   * (`answerWindowMs`, Luyện ngắm): scene nghe kết quả để vào khoá và đồng bộ lại câu đang làm.
   * Promise có thể trả về sau khi scene đã bị huỷ.
   */
  answerOutcome(index: number): Promise<AnswerOutcome | null>;
  /**
   * (Tuỳ chọn) Theo dõi kết nối cho game có đồng hồ riêng trong scene (vd. bia hết hạn tự gửi
   * "bỏ lỡ", Luyện ngắm). `paused`: mất kết nối, scene dừng đồng hồ và không gửi gì (SDK xếp hàng
   * tin gửi lúc này rồi phát khi nối lại, server sẽ lệch câu). `resumed`: đã nối lại và state đầy
   * đủ của server đã về, scene hiện lại đúng câu server đang chờ (`SceneResync`). Gọi ngay
   * `paused` nếu lúc đăng ký đang mất kết nối. Trả hàm huỷ. Luyện tập (chạy trên máy) không có.
   */
  watchConnection?(listener: (event: ConnectionEvent) => void): () => void;
  /**
   * (Tuỳ chọn) Câu server đang chờ theo state đồng bộ, để scene tự đồng bộ lại khi một câu đã gửi
   * bị server bỏ qua (`answerOutcome` trả `null`). `undefined` = không biết.
   */
  serverSync?(): SceneResync | undefined;
}

/** Câu server đang chờ, đã quy về đồng hồ máy. */
export interface SceneResync {
  /** Câu đang làm theo server (`progress` của state). */
  progress: number;
  /**
   * Số ms còn khoá sau câu `progress − 1` (server chấm sai, `lockedUntil`); 0 = không khoá hoặc
   * không biết. Server không đồng bộ `lockedUntil` trong state nên lấy từ kết quả câu cuối đã nhận.
   */
  unlockMs: number;
}

/** `resumed.sync` = `undefined` khi state không có người này (không biết câu server đang chờ). */
export type ConnectionEvent =
  | { type: "paused" }
  | { type: "resumed"; sync: SceneResync | undefined };

/** Kết quả server chấm một câu, đã quy về đồng hồ máy. */
export interface AnswerOutcome {
  correct: boolean;
  /** Số ms còn lại tới `lockedUntil` của server (0 = không khoá hoặc đã hết khoá). */
  unlockMs: number;
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
  /**
   * (Tuỳ chọn) Biểu tượng riêng của game, gọn hơn hình minh hoạ: ô hình trên trống quay và thẻ
   * game (CR-017). Có thì ưu tiên hơn `Illustration`. SVG vẽ trên nền bảng (`bg-board`), cao kín ô.
   */
  Icon?: ComponentType<{ className?: string }>;
  /**
   * (Tuỳ chọn) Hình minh hoạ động (CR-021, UI-UX 6.11): khung diễn SVG + CSS trong
   * `games/_shared/demo/`, tải lười (`React.lazy`). Màn Hướng dẫn dùng `Demo` nếu có, không có thì
   * `Illustration` tĩnh. KHÔNG dùng ở thẻ nhỏ (`GameThumb`, lưới chọn game, trống quay).
   */
  Demo?: ComponentType<DemoProps>;
}

/** Prop của `GameClient.Demo`. */
export interface DemoProps {
  className?: string;
  /** `false` = dừng ở khung hiện tại (mặc định chạy). */
  playing?: boolean;
  /** Số vòng chạy rồi đứng ở khung tĩnh; bỏ trống = lặp mãi. */
  loops?: number;
  /** Gọi một lần khi chạy đủ `loops` vòng. */
  onEnd?: () => void;
}

/** Kích thước thiết kế (dọc), Phaser scale FIT theo màn hình thật. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
