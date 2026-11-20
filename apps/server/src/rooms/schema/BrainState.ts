import { type SchemaType, schema, t } from "@colyseus/schema";

/**
 * State đồng bộ của phòng Kiểm tra não. Hình dạng phải khớp `BrainGameView` / `BrainStateView`
 * trong @brain-rizz/shared (test "state khớp BrainStateView" trong test/BrainTestRoom.test.ts).
 * Không bao giờ chứa token hay user_id.
 */
export const BrainGame = schema(
  {
    gameId: t.string(),
    /** Category — nhóm kỹ năng của game. */
    category: t.string(),
    score: t.uint32().default(0),
    correct: t.uint16().default(0),
  },
  "BrainGame",
);
export type BrainGame = SchemaType<typeof BrainGame>;

export const BrainState = schema(
  {
    /** BrainPhase: intro | countdown | playing | game-result | finished. */
    phase: t.string().default("intro"),
    name: t.string().default(""),
    avatar: t.string().default("khoi"),
    difficulty: t.uint8().default(1),
    games: t.array(BrainGame),
    /** Thứ tự game hiện tại, 1–5. */
    round: t.uint8().default(0),
    gameId: t.string().default(""),
    seed: t.uint32().default(0),
    startAt: t.float64().default(0),
    endsAt: t.float64().default(0),
    resultEndsAt: t.float64().default(0),
    progress: t.uint16().default(0),
    streak: t.uint8().default(0),
    brainScore: t.number().default(0),
    /** Category → điểm kỹ năng; rỗng tới khi xong lượt. */
    skills: t.map("number"),
    /** BrainSaveStatus: pending | saved | guest | no-db | failed. */
    saveStatus: t.string().default("pending"),
    /** Phấn nhận được từ lượt này, đã kẹp trần ngày (CR-023); 0 tới khi ghi phấn xong. */
    chalkEarned: t.uint16().default(0),
  },
  "BrainState",
);
export type BrainState = SchemaType<typeof BrainState>;
