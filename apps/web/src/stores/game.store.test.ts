import type { AnswerResultPayload, PartyStateView, PlayerView } from "@brain-rizz/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useGame } from "./game.store";

const ME = "me";

function party(over: Partial<PartyStateView> = {}): PartyStateView {
  return {
    code: "ABCD",
    phase: "playing",
    hostId: ME,
    gameId: "odd-one-out",
    round: 1,
    totalRounds: 3,
    seed: 111,
    startAt: 1_000,
    endsAt: 46_000,
    players: {
      [ME]: { id: ME, name: "An", progress: 4, roundScore: 320, difficulty: 2 } as PlayerView,
    },
    ...over,
  } as PartyStateView;
}

const wrong: AnswerResultPayload = { index: 3, correct: false, points: 0, lockedUntil: 9_000 };

beforeEach(() => {
  useGame.getState().reset();
});

describe("store phòng chơi: state đồng bộ là nguồn chính, tin roundStart chỉ phụ", () => {
  it("tải lại trang giữa pha playing: chỉ có state, không có roundStart → vẫn đủ seed, vòng, tiến độ cho HUD", () => {
    const s = useGame.getState();
    s.setSession(ME);
    s.setParty(party({ seed: 777, round: 2 }));

    const after = useGame.getState();
    expect(after.party?.seed).toBe(777);
    expect(after.party?.round).toBe(2);
    expect(after.party?.players[ME]?.progress).toBe(4);
    expect(after.lastAnswer).toBeNull();
  });

  it("roundStart tới trước bản vá state (tin gửi ngay, state theo nhịp patch) → bản vá sau vẫn sang vòng mới, không hiện lại kết quả câu cũ", () => {
    const s = useGame.getState();
    s.setParty(party({ seed: 111, phase: "game-intro" }));
    s.pushAnswerResult(wrong);
    s.onRoundStart();

    // Giữa tin và bản vá: kết quả câu cũ đã bỏ ngay, còn vòng/seed vẫn theo state (chưa đổi).
    const between = useGame.getState();
    expect(between.lastAnswer).toBeNull();
    expect(between.party?.seed).toBe(111);
    expect(between.party?.round).toBe(1);

    s.setParty(party({ seed: 222, phase: "countdown", round: 2 }));

    const after = useGame.getState();
    expect(after.party?.seed).toBe(222);
    expect(after.party?.round).toBe(2);
    expect(after.lastAnswer).toBeNull();
  });

  it("mất tin roundStart lúc SDK tự nối lại: seed trong state đổi → bỏ kết quả câu của vòng cũ", () => {
    const s = useGame.getState();
    s.setParty(party({ seed: 111 }));
    s.onRoundStart();
    s.pushAnswerResult(wrong);

    s.setParty(party({ seed: 333, round: 2, phase: "countdown" }));

    const after = useGame.getState();
    expect(after.lastAnswer).toBeNull();
    expect(after.party?.seed).toBe(333);
  });

  it("bản vá state trong cùng vòng (điểm, tiến độ) không xoá kết quả câu vừa trả lời — huy hiệu khoá không bị tắt sớm", () => {
    const s = useGame.getState();
    s.setParty(party({ seed: 111 }));
    s.onRoundStart();
    s.pushAnswerResult(wrong);

    s.setParty(party({ seed: 111, players: { [ME]: { id: ME, progress: 5 } as PlayerView } }));

    const after = useGame.getState();
    expect(after.lastAnswer).toEqual(wrong);
    expect(after.party?.players[ME]?.progress).toBe(5);
  });

  it("roundStart mới xoá kết quả câu của vòng trước", () => {
    const s = useGame.getState();
    s.pushAnswerResult(wrong);
    s.onRoundStart();
    expect(useGame.getState().lastAnswer).toBeNull();
  });

  it("mỗi lỗi server tăng errorSeq (mở khoá nút đang chờ); reset về trạng thái đầu", () => {
    const s = useGame.getState();
    s.pushError();
    s.pushError();
    expect(useGame.getState().errorSeq).toBe(2);

    s.setSession(ME);
    s.setParty(party());
    s.setConnection("online");
    s.reset();
    const after = useGame.getState();
    expect(after.party).toBeNull();
    expect(after.sessionId).toBe("");
    expect(after.errorSeq).toBe(0);
    expect(after.connection).toBe("offline");
  });
});
