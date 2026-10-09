import type { Difficulty } from "@brain-rizz/shared";

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
}

/** Kích thước thiết kế (dọc), Phaser scale FIT theo màn hình thật. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
