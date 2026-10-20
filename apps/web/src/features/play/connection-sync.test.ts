import type { AnswerResultPayload, BrainStateView, PartyStateView } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionEvent } from "@/games/types";
import { useGame } from "@/stores/game.store";
import {
  brainProgress,
  connectionSync,
  partyProgress,
  RESYNC_STATE_TIMEOUT_MS,
  serverSyncOf,
  watchConnectionOf,
} from "./connection-sync";

const LOCAL_NOW = 50_000;
const ME = "me";

/** State party tối giản: chỉ các trường helper đọc. */
const party = (progress: number, seed = 1) =>
  ({ seed, players: { [ME]: { progress } } }) as unknown as PartyStateView;

const wrong = (index: number, lockedUntil: number): AnswerResultPayload => ({
  index,
  correct: false,
  points: 0,
  lockedUntil,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(LOCAL_NOW);
  useGame.getState().reset();
  useGame.getState().setSession(ME);
  useGame.getState().setConnection("online");
  useGame.getState().setParty(party(3));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("serverSyncOf", () => {
  it("đọc progress của mình; không khoá khi kết quả cuối không phải câu ngay trước", () => {
    useGame.getState().pushAnswerResult(wrong(1, LOCAL_NOW + 1_000));
    expect(serverSyncOf(partyProgress)).toEqual({ progress: 3, unlockMs: 0 });
  });

  it("câu ngay trước bị chấm sai, còn khoá: trả số ms còn khoá", () => {
    useGame.getState().pushAnswerResult(wrong(2, LOCAL_NOW + 900));
    expect(serverSyncOf(partyProgress)).toEqual({ progress: 3, unlockMs: 900 });
  });

  it("không có mình trong state: undefined", () => {
    useGame.getState().setSession("other");
    expect(serverSyncOf(partyProgress)).toBeUndefined();
    expect(serverSyncOf(brainProgress)).toBeUndefined();
  });

  it("Kiểm tra não đọc progress của phòng", () => {
    useGame.getState().setBrain({ seed: 9, progress: 6 } as unknown as BrainStateView);
    expect(serverSyncOf(brainProgress)).toEqual({ progress: 6, unlockMs: 0 });
  });
});

describe("watchConnectionOf", () => {
  const watch = () => {
    const events: ConnectionEvent[] = [];
    const stop = watchConnectionOf(partyProgress, (e) => events.push(e));
    return { events, stop };
  };

  it("mất kết nối → paused; nối lại chỉ báo resumed khi state mới của server về", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("reconnecting");
    expect(events).toEqual([{ type: "paused" }]);

    // Store sang online trước khi server gửi state đầy đủ: chưa báo.
    useGame.getState().setConnection("online");
    expect(events).toHaveLength(1);

    useGame.getState().setParty(party(5));
    expect(events).toEqual([
      { type: "paused" },
      { type: "resumed", sync: { progress: 5, unlockMs: 0 } },
    ]);

    // State đổi tiếp sau đó không báo lại.
    useGame.getState().setParty(party(6));
    expect(events).toHaveLength(2);
    stop();
  });

  it("không thấy state mới sau khi nối lại: vẫn báo resumed sau thời gian chờ", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    vi.advanceTimersByTime(RESYNC_STATE_TIMEOUT_MS - 1);
    expect(events).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(events.at(-1)).toEqual({ type: "resumed", sync: { progress: 3, unlockMs: 0 } });
    stop();
  });

  it("rớt lại trong lúc chờ state: chỉ paused, không resumed", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    useGame.getState().setConnection("reconnecting");
    vi.advanceTimersByTime(RESYNC_STATE_TIMEOUT_MS * 2);
    expect(events).toEqual([{ type: "paused" }, { type: "paused" }]);
    stop();
  });

  it("phòng đóng hẳn (offline) trong lúc chờ state: huỷ hẹn giờ, không resumed", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    useGame.getState().setConnection("offline");
    vi.advanceTimersByTime(RESYNC_STATE_TIMEOUT_MS * 2);
    useGame.getState().setParty(party(5));
    expect(events).toEqual([{ type: "paused" }, { type: "paused" }]);
    stop();
  });

  it("phòng đóng hẳn khi đang chơi: paused, không resumed", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("offline");
    useGame.getState().setParty(party(4));
    vi.advanceTimersByTime(RESYNC_STATE_TIMEOUT_MS * 2);
    expect(events).toEqual([{ type: "paused" }]);
    stop();
  });

  it("đăng ký lúc đang mất kết nối: báo paused ngay", () => {
    useGame.getState().setConnection("reconnecting");
    const { events, stop } = watch();
    expect(events).toEqual([{ type: "paused" }]);
    stop();
  });

  it("state đổi khi đang online không báo gì", () => {
    const { events, stop } = watch();
    useGame.getState().setParty(party(4));
    expect(events).toEqual([]);
    stop();
  });

  it("huỷ theo dõi: không báo nữa, kể cả hẹn giờ đang chờ", () => {
    const { events, stop } = watch();
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    stop();
    vi.advanceTimersByTime(RESYNC_STATE_TIMEOUT_MS);
    useGame.getState().setConnection("reconnecting");
    expect(events).toEqual([{ type: "paused" }]);
  });
});

describe("watchConnectionOf — bổ sung (QA)", () => {
  it("Kiểm tra não: resumed khi state phòng não về sau lúc online", () => {
    useGame.getState().setBrain({ seed: 9, progress: 4 } as unknown as BrainStateView);
    const events: ConnectionEvent[] = [];
    const stop = watchConnectionOf(brainProgress, (e) => events.push(e));
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    expect(events).toEqual([{ type: "paused" }]);
    useGame.getState().setBrain({ seed: 9, progress: 7 } as unknown as BrainStateView);
    expect(events.at(-1)).toEqual({ type: "resumed", sync: { progress: 7, unlockMs: 0 } });
    stop();
  });

  it("server chấm sai câu ngay trước lúc rớt mạng: resumed mang số ms còn khoá", () => {
    const events: ConnectionEvent[] = [];
    const stop = watchConnectionOf(partyProgress, (e) => events.push(e));
    useGame.getState().setConnection("reconnecting");
    useGame.getState().pushAnswerResult(wrong(4, LOCAL_NOW + 700));
    useGame.getState().setConnection("online");
    useGame.getState().setParty(party(5));
    expect(events.at(-1)).toEqual({ type: "resumed", sync: { progress: 5, unlockMs: 700 } });
    stop();
  });

  it("chỉ kết quả câu mới (lastAnswer) đổi trong lúc chờ state thì chưa báo resumed", () => {
    const events: ConnectionEvent[] = [];
    const stop = watchConnectionOf(partyProgress, (e) => events.push(e));
    useGame.getState().setConnection("reconnecting");
    useGame.getState().setConnection("online");
    useGame.getState().pushAnswerResult(wrong(2, LOCAL_NOW + 500));
    expect(events).toEqual([{ type: "paused" }]);
    stop();
  });

  it("connectionSync gói hai hàm bridge theo state đang mở", () => {
    const bridge = connectionSync(partyProgress);
    expect(bridge.serverSync()).toEqual({ progress: 3, unlockMs: 0 });
    const events: ConnectionEvent[] = [];
    const stop = bridge.watchConnection((e) => events.push(e));
    useGame.getState().setConnection("reconnecting");
    expect(events).toEqual([{ type: "paused" }]);
    stop();
  });
});
