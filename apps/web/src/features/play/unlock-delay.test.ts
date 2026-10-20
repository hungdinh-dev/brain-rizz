import type { AnswerResultPayload } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGame } from "@/stores/game.store";
import {
  UNLOCK_RESULT_TIMEOUT_MS,
  unlockDelayOf,
  waitAnswerOutcome,
  waitUnlockDelay,
} from "./unlock-delay";

// Giờ máy cố định; server nhanh hơn máy 2 giây.
const LOCAL_NOW = 100_000;
const OFFSET = 2_000;

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
  useGame.getState().setClockOffset(OFFSET);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("unlockDelayOf", () => {
  it("quy lockedUntil (giờ server) về số ms còn lại theo đồng hồ máy", () => {
    expect(unlockDelayOf(wrong(0, LOCAL_NOW + OFFSET + 1_200))).toBe(1_200);
  });

  it("không khoá hoặc đã hết khoá → 0", () => {
    expect(unlockDelayOf({ index: 0, correct: true, points: 100 })).toBe(0);
    expect(unlockDelayOf(wrong(0, LOCAL_NOW + OFFSET - 50))).toBe(0);
  });
});

describe("waitUnlockDelay", () => {
  it("chờ đúng kết quả của câu đó, bỏ qua kết quả câu khác", async () => {
    let delay: number | undefined;
    void waitUnlockDelay(5).then((ms) => {
      delay = ms;
    });

    useGame.getState().pushAnswerResult(wrong(4, LOCAL_NOW + OFFSET + 1_500));
    await vi.advanceTimersByTimeAsync(100);
    expect(delay).toBeUndefined();

    useGame.getState().pushAnswerResult(wrong(5, LOCAL_NOW + OFFSET + 1_500));
    await vi.advanceTimersByTimeAsync(0);
    // Kết quả tới sau 100 ms → còn 1 400 ms khoá.
    expect(delay).toBe(1_400);
  });

  it("kết quả đã có sẵn trong store → trả về ngay", async () => {
    useGame.getState().pushAnswerResult(wrong(2, LOCAL_NOW + OFFSET + 900));
    await expect(waitUnlockDelay(2)).resolves.toBe(900);
  });

  it("không có kết quả → hết hạn chờ thì trả về 0 và thôi theo dõi store", async () => {
    let delay: number | undefined;
    void waitUnlockDelay(7).then((ms) => {
      delay = ms;
    });

    await vi.advanceTimersByTimeAsync(UNLOCK_RESULT_TIMEOUT_MS - 1);
    expect(delay).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(delay).toBe(0);

    // Kết quả về muộn không làm gì nữa (đã huỷ đăng ký).
    useGame.getState().pushAnswerResult(wrong(7, LOCAL_NOW + OFFSET + 5_000));
    expect(delay).toBe(0);
  });
});

describe("waitAnswerOutcome", () => {
  it("câu đúng → correct, không khoá", async () => {
    let outcome: unknown;
    void waitAnswerOutcome(3).then((o) => {
      outcome = o;
    });
    useGame.getState().pushAnswerResult({ index: 3, correct: true, points: 120 });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toEqual({ correct: true, unlockMs: 0 });
  });

  it("cú trúng bị server chấm muộn → sai kèm số ms còn khoá", async () => {
    let outcome: unknown;
    void waitAnswerOutcome(4).then((o) => {
      outcome = o;
    });
    await vi.advanceTimersByTimeAsync(200);
    useGame.getState().pushAnswerResult(wrong(4, LOCAL_NOW + OFFSET + 1_500));
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toEqual({ correct: false, unlockMs: 1_300 });
  });

  it("không có kết quả → null khi hết hạn chờ", async () => {
    let outcome: unknown = "chưa";
    void waitAnswerOutcome(9).then((o) => {
      outcome = o;
    });
    await vi.advanceTimersByTimeAsync(UNLOCK_RESULT_TIMEOUT_MS);
    expect(outcome).toBeNull();
  });
});
