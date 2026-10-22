import { type SchemaType, schema, t } from "@colyseus/schema";

/**
 * State đồng bộ tự động (delta nhị phân) từ server xuống mọi client.
 * Hình dạng phải khớp với `PlayerView` / `PartyStateView` trong @brain-rizz/shared
 * (test "state khớp PartyStateView" trong test/PartyRoom.test.ts kiểm tra điều này).
 */
export const Player = schema(
  {
    id: t.string(),
    name: t.string(),
    colorIndex: t.uint8(),
    /** CharacterId — được phép trùng giữa người chơi. */
    avatar: t.string().default("khoi"),
    /** Độ khó cho vòng hiện tại; chọn lại ở pha game-intro. */
    difficulty: t.uint8().default(1),
    ready: t.boolean().default(false),
    /** Đã bấm "Đã hiểu" ở màn hướng dẫn. */
    introReady: t.boolean().default(false),
    connected: t.boolean().default(true),
    isHost: t.boolean().default(false),
    matchPoints: t.uint16().default(0),
    /** Điểm trận vừa cộng ở vòng gần nhất. */
    lastPoints: t.uint8().default(0),
    /** Tổng điểm vòng cả trận (phá hoà chung cuộc). */
    totalScore: t.uint32().default(0),
    /**
     * Category → tổng điểm vòng cả trận ở thể loại đó (CR-010). Chỉ thể loại đã chơi mới có
     * khoá (kể cả 0 điểm); xoá sạch khi Chơi lại / Về phòng chờ.
     */
    categoryScores: t.map("uint32"),
    roundScore: t.uint32().default(0),
    roundCorrect: t.uint16().default(0),
    progress: t.uint16().default(0),
    streak: t.uint8().default(0),
    /** Ghế do server chơi thay (CR-016): `name = ""`, luôn sẵn sàng, không làm chủ phòng. */
    isBot: t.boolean().default(false),
    /** Mức bot 0 Dễ … 3 Siêu (`BotLevel`); người thật luôn 0. */
    botLevel: t.uint8().default(0),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

export const PartyState = schema(
  {
    code: t.string(),
    phase: t.string().default("lobby"),
    hostId: t.string().default(""),
    gameId: t.string().default(""),
    round: t.uint8().default(0),
    totalRounds: t.uint8().default(3),
    seed: t.uint32().default(0),
    startAt: t.float64().default(0),
    endsAt: t.float64().default(0),
    /** PickMode: "wheel" | "pick". */
    pickMode: t.string().default("wheel"),
    /** sessionId → gameId, chỉ người không phải chủ phòng. */
    votes: t.map("string"),
    playedGames: t.array("string"),
    wheelGameId: t.string().default(""),
    wheelSpinAt: t.float64().default(0),
    wheelSpinMs: t.uint32().default(0),
    introEndsAt: t.float64().default(0),
    /**
     * Chat cả phòng đang bật (CR-011). Chỉ cờ này nằm trong state; nội dung chat đi bằng tin
     * nhắn một lần. Giữ nguyên qua Chơi lại / Về phòng chờ.
     */
    chatEnabled: t.boolean().default(true),
    players: t.map(Player),
  },
  "PartyState",
);
export type PartyState = SchemaType<typeof PartyState>;
