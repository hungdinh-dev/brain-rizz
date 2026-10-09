import { type SchemaType, schema, t } from "@colyseus/schema";

/**
 * State đồng bộ tự động (delta nhị phân) từ server xuống mọi client.
 * Hình dạng phải khớp với `PlayerView` / `PartyStateView` trong @brain-rizz/shared.
 */
export const Player = schema(
  {
    id: t.string(),
    name: t.string(),
    colorIndex: t.uint8(),
    difficulty: t.uint8().default(1),
    ready: t.boolean().default(false),
    connected: t.boolean().default(true),
    isHost: t.boolean().default(false),
    matchPoints: t.uint16().default(0),
    roundScore: t.uint32().default(0),
    progress: t.uint16().default(0),
    streak: t.uint8().default(0),
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
    players: t.map(Player),
  },
  "PartyState",
);
export type PartyState = SchemaType<typeof PartyState>;
