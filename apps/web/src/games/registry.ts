import type { GameId } from "@brain-rizz/shared";
import { balanceClient } from "./balance";
import { cashCountClient } from "./cash-count";
import { foldBoxClient } from "./fold-box";
import { hitTargetClient } from "./hit-target";
import { lightTrailClient } from "./light-trail";
import { numberBalloonsClient } from "./number-balloons";
import { oddOneOutClient } from "./odd-one-out";
import { rotateMatchClient } from "./rotate-match";
import { topViewClient } from "./top-view";
import type { GameClient } from "./types";

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
  // @new-game:entry
} satisfies Record<GameId, GameClient>;
