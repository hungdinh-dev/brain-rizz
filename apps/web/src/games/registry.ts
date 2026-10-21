import type { GameId } from "@brain-rizz/shared";
import { aimTrainerClient } from "./aim-trainer";
import { balanceClient } from "./balance";
import { beadPatternClient } from "./bead-pattern";
import { bestBasketClient } from "./best-basket";
import { cashCountClient } from "./cash-count";
import { chalkArrowsClient } from "./chalk-arrows";
import { circuitLinkClient } from "./circuit-link";
import { crowdSearchClient } from "./crowd-search";
import { cubeCountClient } from "./cube-count";
import { cupShuffleClient } from "./cup-shuffle";
import { foldBoxClient } from "./fold-box";
import { headCountClient } from "./head-count";
import { hitTargetClient } from "./hit-target";
import { latinCellClient } from "./latin-cell";
import { lightTrailClient } from "./light-trail";
import { marbleDropClient } from "./marble-drop";
import { navonShapesClient } from "./navon-shapes";
import { numberBalloonsClient } from "./number-balloons";
import { numberPathClient } from "./number-path";
import { oddOneOutClient } from "./odd-one-out";
import { pairFlipClient } from "./pair-flip";
import { pieceFitClient } from "./piece-fit";
import { pourLineClient } from "./pour-line";
import { rhythmEchoClient } from "./rhythm-echo";
import { rotateMatchClient } from "./rotate-match";
import { ruleGateClient } from "./rule-gate";
import { shadowMatchClient } from "./shadow-match";
import { stackRecallClient } from "./stack-recall";
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
  "cup-shuffle": cupShuffleClient,
  "stack-recall": stackRecallClient,
  "bead-pattern": beadPatternClient,
  "head-count": headCountClient,
  "piece-fit": pieceFitClient,
  "latin-cell": latinCellClient,
  "circuit-link": circuitLinkClient,
  "crowd-search": crowdSearchClient,
  "best-basket": bestBasketClient,
  "pour-line": pourLineClient,
  "navon-shapes": navonShapesClient,
  "rhythm-echo": rhythmEchoClient,
  "rule-gate": ruleGateClient,
  "number-path": numberPathClient,
  // @new-game:entry
} satisfies Record<GameId, GameClient>;
