import type { GameId } from "@brain-rizz/shared";
import type Phaser from "phaser";

type SceneModule = { default: new () => Phaser.Scene };

/**
 * Mỗi minigame là một chunk riêng, chỉ tải khi vòng chơi bắt đầu.
 * `satisfies` bắt buộc mọi GameId trong shared đều có scene tương ứng.
 */
export const SCENES = {
  "odd-one-out": () => import("./odd-one-out/OddOneOutScene"),
} satisfies Record<GameId, () => Promise<SceneModule>>;
