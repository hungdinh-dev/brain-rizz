import type { GameId } from "@brain-rizz/shared";
import { aimTrainerClient } from "./aim-trainer";
import { balanceClient } from "./balance";
import { cashCountClient } from "./cash-count";
import { chalkArrowsClient } from "./chalk-arrows";
import { cubeCountClient } from "./cube-count";
import { foldBoxClient } from "./fold-box";
import { hitTargetClient } from "./hit-target";
import { lightTrailClient } from "./light-trail";
import { marbleDropClient } from "./marble-drop";
import { numberBalloonsClient } from "./number-balloons";
import { oddOneOutClient } from "./odd-one-out";
import { pairFlipClient } from "./pair-flip";
import { rotateMatchClient } from "./rotate-match";
import { shadowMatchClient } from "./shadow-match";
import { topViewClient } from "./top-view";
import type { GameClient } from "./types";
import { whoVanishedClient } from "./who-vanished";

/**
 * Nối mã game → phần web của game (scene Phaser + chữ hiển thị).
 * `satisfies` bắt buộc mọi GameId trong shared đều có mặt ở đây — quên là TypeScript báo lỗi.
 */
export const GAME_CLIENTS = {
  "odd-one-out": oddOneOutClient,
  "light-trail": lightTrailClient,
  balance: balanceClient,
  "number-balloons": numberBalloonsClient,
  "rotate-match": rotateMatchClient,
  "hit-target": hitTargetClient,
  "cash-count": cashCountClient,
  "top-view": topViewClient,
  "fold-box": foldBoxClient,
  "who-vanished": whoVanishedClient,
  "pair-flip": pairFlipClient,
  "cube-count": cubeCountClient,
  "marble-drop": marbleDropClient,
  "shadow-match": shadowMatchClient,
  "aim-trainer": aimTrainerClient,
  "chalk-arrows": chalkArrowsClient,
  // @new-game:entry
} satisfies Record<GameId, GameClient>;
