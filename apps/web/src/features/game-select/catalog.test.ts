import {
  availableGames,
  enabledGameIds,
  GAME_IDS,
  type GameId,
  type PartyStateView,
  PLANNED_GAME_COUNT,
  type PlayerView,
} from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  CATALOG,
  desktopSoonLayout,
  enabledGames,
  pickableGames,
  playedNote,
  tallyVotes,
  topVoted,
  UPCOMING,
  wheelSlices,
} from "./catalog";

const [FIRST, SECOND, THIRD] = GAME_IDS as unknown as [GameId, GameId, GameId];

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
  it("có đủ PLANNED_GAME_COUNT (31) game, id không trùng, mọi game đã đăng ký đều nằm trong danh mục", () => {
    const ids = CATALOG.map((g) => g.id);
    expect(PLANNED_GAME_COUNT).toBe(31);
    expect(new Set(ids).size).toBe(PLANNED_GAME_COUNT);
    for (const id of GAME_IDS) expect(ids).toContain(id);
    expect(UPCOMING.length).toBe(PLANNED_GAME_COUNT - GAME_IDS.length);
  });
});

describe("trống quay", () => {
  it("bỏ game đã chơi nhưng vẫn giữ kết quả server đã chọn", () => {
    expect(wheelSlices(party({}))).toEqual([...GAME_IDS]);
    expect(wheelSlices(party({ playedGames: [FIRST] }))).not.toContain(FIRST);
    const slices = wheelSlices(party({ playedGames: [FIRST], wheelGameId: FIRST }));
    expect(slices).toContain(FIRST);
  });

  it("bỏ game admin tắt (CR-019), cùng thứ tự với server", () => {
    const p = party({ disabledGames: [SECOND, THIRD], playedGames: [FIRST] });
    const expected = availableGames([FIRST], enabledGameIds([SECOND, THIRD]));
    expect(wheelSlices(p)).toEqual(expected);
    expect(wheelSlices(p)).not.toContain(SECOND);
    expect(pickableGames(p)).toEqual(expected);
    expect(enabledGames(p)).toEqual(GAME_IDS.filter((id) => id !== SECOND && id !== THIRD));
  });

  it("vẫn giữ kết quả server dù game đó vừa bị tắt", () => {
    const p = party({ disabledGames: [SECOND], wheelGameId: SECOND });
    expect(wheelSlices(p)).toContain(SECOND);
    expect(pickableGames(p)).not.toContain(SECOND);
  });

  it("tắt gần hết (còn < 2 game) thì dùng cả danh mục như server", () => {
    const p = party({ disabledGames: GAME_IDS.slice(1) });
    expect(enabledGames(p)).toEqual([...GAME_IDS]);
    expect(wheelSlices(p)).toEqual([...GAME_IDS]);
  });

  it("chơi hết game đang bật thì trống vẫn có dòng (danh sách game đang bật)", () => {
    const enabled = GAME_IDS.filter((id) => id !== SECOND);
    const p = party({ disabledGames: [SECOND], playedGames: enabled });
    expect(wheelSlices(p)).toEqual(enabled);
  });

  it("dòng phấn: game đã chơi (không còn trên trống), tối đa 2 tên rồi +n", () => {
    expect(playedNote(party({}), wheelSlices(party({})))).toEqual({ shown: [], more: 0 });
    const played = GAME_IDS.slice(0, 4);
    const p = party({ playedGames: played });
    expect(playedNote(p, wheelSlices(p))).toEqual({ shown: played.slice(0, 2), more: 2 });
    // Kết quả vừa quay (đã chơi nhưng vẫn trên trống) không tính.
    const q = party({ playedGames: [FIRST], wheelGameId: FIRST });
    expect(playedNote(q, wheelSlices(q))).toEqual({ shown: [], more: 0 });
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

describe("ô Sắp có trên máy tính", () => {
  it("còn chỗ thì hiện đủ thẻ, thiếu chỗ thì gom ô cuối thành +N", () => {
    expect(desktopSoonLayout(4, 3, 8)).toEqual({ cards: 3, more: 0 });
    expect(desktopSoonLayout(4, 11, 8)).toEqual({ cards: 3, more: 8 });
    expect(desktopSoonLayout(7, 8, 8)).toEqual({ cards: 0, more: 8 });
  });

  it("game vượt số ô thì hiện đủ thẻ sắp có, không có ô +N; đủ 15 game thì không còn ô nào", () => {
    expect(desktopSoonLayout(8, 7, 8)).toEqual({ cards: 7, more: 0 });
    expect(desktopSoonLayout(13, 2, 8)).toEqual({ cards: 2, more: 0 });
    expect(desktopSoonLayout(15, 0, 8)).toEqual({ cards: 0, more: 0 });
  });

  it("tổng thẻ sắp có + số gom luôn bằng số game sắp có", () => {
    for (let games = 0; games <= 15; games++) {
      const { cards, more } = desktopSoonLayout(games, 15 - games, 8);
      expect(cards).toBeGreaterThanOrEqual(0);
      expect(cards + more).toBe(15 - games);
    }
  });
});
