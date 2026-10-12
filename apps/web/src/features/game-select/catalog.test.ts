import { GAME_IDS, type PartyStateView, type PlayerView } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { CATALOG, tallyVotes, topVoted, UPCOMING, wheelSlices } from "./catalog";

const FIRST = GAME_IDS[0];

function party(over: Partial<PartyStateView>): PartyStateView {
  return {
    players: {},
    votes: {},
    playedGames: [],
    wheelGameId: "",
    ...over,
  } as PartyStateView;
}

const player = (id: string) => ({ id, name: id }) as PlayerView;

describe("danh mục game", () => {
  it("có đủ 15 game, id không trùng, mọi game đã đăng ký đều nằm trong danh mục", () => {
    const ids = CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(15);
    for (const id of GAME_IDS) expect(ids).toContain(id);
    expect(UPCOMING.length).toBe(15 - GAME_IDS.length);
  });
});

describe("vòng quay", () => {
  it("bỏ game đã chơi nhưng vẫn giữ kết quả server đã chọn", () => {
    expect(wheelSlices(party({}))).toEqual([...GAME_IDS]);
    const slices = wheelSlices(party({ playedGames: [FIRST], wheelGameId: FIRST }));
    expect(slices).toContain(FIRST);
  });
});

describe("bình chọn", () => {
  it("đếm phiếu, bỏ phiếu của người đã rời phòng và game lạ", () => {
    const p = party({
      players: { a: player("a"), b: player("b") },
      votes: { a: FIRST, b: FIRST, ghost: FIRST, c: "khong-co" },
    });
    const tally = tallyVotes(p);
    expect(tally.get(FIRST)?.map((x) => x.id)).toEqual(["a", "b"]);
    expect(topVoted(tally)).toEqual({ id: FIRST, votes: 2 });
    expect(topVoted(new Map())).toBeNull();
  });
});
