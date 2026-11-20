import { aimTrainer } from "./aim-trainer/aim-trainer";
import { balance } from "./balance/balance";
import { beadPattern } from "./bead-pattern/bead-pattern";
import { bestBasket } from "./best-basket/best-basket";
import { cashCount } from "./cash-count/cash-count";
import { chalkArrows } from "./chalk-arrows/chalk-arrows";
import { circuitLink } from "./circuit-link/circuit-link";
import { crowdSearch } from "./crowd-search/crowd-search";
import { cubeCount } from "./cube-count/cube-count";
import { cupShuffle } from "./cup-shuffle/cup-shuffle";
import { foldBox } from "./fold-box/fold-box";
import { headCount } from "./head-count/head-count";
import { hitTarget } from "./hit-target/hit-target";
import { latinCell } from "./latin-cell/latin-cell";
import { lightTrail } from "./light-trail/light-trail";
import { marbleDrop } from "./marble-drop/marble-drop";
import { navonShapes } from "./navon-shapes/navon-shapes";
import { numberBalloons } from "./number-balloons/number-balloons";
import { numberPath } from "./number-path/number-path";
import { oddOneOut } from "./odd-one-out/odd-one-out";
import { pairFlip } from "./pair-flip/pair-flip";
import { pieceFit } from "./piece-fit/piece-fit";
import { pourLine } from "./pour-line/pour-line";
import { rhythmEcho } from "./rhythm-echo/rhythm-echo";
import { rotateMatch } from "./rotate-match/rotate-match";
import { ruleGate } from "./rule-gate/rule-gate";
import { shadowMatch } from "./shadow-match/shadow-match";
import { stackRecall } from "./stack-recall/stack-recall";
import { topView } from "./top-view/top-view";
import type { AnyMinigame } from "./types";
import { whoVanished } from "./who-vanished/who-vanished";

/**
 * Danh mục minigame. Mỗi game là một thư mục `src/games/<id>/` (bộ sinh câu đố + test).
 * Tạo game mới bằng `pnpm new-game <id> <nhóm>` — script tự đăng ký vào đây.
 * Xem docs/03-guides/development.md mục "Thêm một minigame".
 */
export const GAMES = {
  "odd-one-out": oddOneOut,
  "light-trail": lightTrail,
  balance: balance,
  "number-balloons": numberBalloons,
  "rotate-match": rotateMatch,
  "hit-target": hitTarget,
  "cash-count": cashCount,
  "top-view": topView,
  "fold-box": foldBox,
  "who-vanished": whoVanished,
  "pair-flip": pairFlip,
  "cube-count": cubeCount,
  "marble-drop": marbleDrop,
  "shadow-match": shadowMatch,
  "aim-trainer": aimTrainer,
  "chalk-arrows": chalkArrows,
  "cup-shuffle": cupShuffle,
  "stack-recall": stackRecall,
  "bead-pattern": beadPattern,
  "head-count": headCount,
  "piece-fit": pieceFit,
  "latin-cell": latinCell,
  "circuit-link": circuitLink,
  "crowd-search": crowdSearch,
  "best-basket": bestBasket,
  "pour-line": pourLine,
  "navon-shapes": navonShapes,
  "rhythm-echo": rhythmEcho,
  "rule-gate": ruleGate,
  "number-path": numberPath,
  // @new-game:entry
} as const satisfies Record<string, AnyMinigame>;

export type GameId = keyof typeof GAMES;

export const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export function isGameId(value: unknown): value is GameId {
  // Object.hasOwn: `in` cũng nhận khoá của prototype ("constructor", "toString"…).
  return typeof value === "string" && Object.hasOwn(GAMES, value);
}

export function getGame(id: GameId): AnyMinigame {
  return GAMES[id];
}

export * from "./aim-trainer/aim-trainer";
export * from "./balance/balance";
export * from "./bead-pattern/bead-pattern";
export * from "./best-basket/best-basket";
export * from "./cash-count/cash-count";
export * from "./chalk-arrows/chalk-arrows";
export * from "./circuit-link/circuit-link";
export * from "./crowd-search/crowd-search";
export * from "./cube-count/cube-count";
export * from "./cup-shuffle/cup-shuffle";
export * from "./fold-box/fold-box";
export * from "./head-count/head-count";
export * from "./hit-target/hit-target";
export * from "./latin-cell/latin-cell";
export * from "./light-trail/light-trail";
export * from "./marble-drop/marble-drop";
export * from "./navon-shapes/navon-shapes";
export * from "./number-balloons/number-balloons";
export * from "./number-path/number-path";
export * from "./odd-one-out/odd-one-out";
export * from "./pair-flip/pair-flip";
export * from "./piece-fit/piece-fit";
export * from "./pour-line/pour-line";
export * from "./rhythm-echo/rhythm-echo";
export * from "./rotate-match/rotate-match";
export * from "./rule-gate/rule-gate";
export * from "./shadow-match/shadow-match";
export * from "./stack-recall/stack-recall";
export * from "./top-view/top-view";
export * from "./types";
export * from "./who-vanished/who-vanished";
