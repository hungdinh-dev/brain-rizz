import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startLoading,
  TOP_LOADING_DELAY_MS,
  TRICKLE_MAX,
  TRICKLE_START,
  trackLoading,
  trickle,
  useTopLoading,
} from "./top-loading.store";

const state = () => useTopLoading.getState();

describe("top-loading.store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTopLoading.setState({ pending: 0, visible: false });
  });
  afterEach(() => {
    if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("tải nhanh hơn ngưỡng thì không hiện thanh", () => {
    const done = startLoading();
    vi.advanceTimersByTime(TOP_LOADING_DELAY_MS - 1);
    done();
    vi.advanceTimersByTime(TOP_LOADING_DELAY_MS * 2);
    expect(state()).toMatchObject({ pending: 0, visible: false });
  });

  it("tải lâu hơn ngưỡng thì hiện, xong vẫn giữ tới khi thanh mờ xong (settle)", () => {
    const done = startLoading();
    expect(state().visible).toBe(false);
    vi.advanceTimersByTime(TOP_LOADING_DELAY_MS);
    expect(state().visible).toBe(true);
    done();
    expect(state()).toMatchObject({ pending: 0, visible: true });
    state().settle();
    expect(state().visible).toBe(false);
  });

  it("đếm nhiều việc: chỉ hết khi việc cuối xong", () => {
    const a = startLoading();
    const b = startLoading();
    vi.advanceTimersByTime(TOP_LOADING_DELAY_MS);
    expect(state()).toMatchObject({ pending: 2, visible: true });
    a();
    expect(state().pending).toBe(1);
    // Còn việc thì settle không ẩn thanh.
    state().settle();
    expect(state().visible).toBe(true);
    b();
    expect(state().pending).toBe(0);
  });

  it("gọi done nhiều lần chỉ tính một", () => {
    const a = startLoading();
    const b = startLoading();
    a();
    a();
    expect(state().pending).toBe(1);
    b();
    expect(state().pending).toBe(0);
  });

  it("ngưỡng tính từ lúc bắt đầu việc đầu tiên, không đặt lại khi thêm việc", () => {
    startLoading();
    vi.advanceTimersByTime(100);
    const second = startLoading();
    vi.advanceTimersByTime(TOP_LOADING_DELAY_MS - 100);
    expect(state().visible).toBe(true);
    second();
  });

  it("trackLoading giữ nguyên kết quả và lỗi, xong thì trả việc", async () => {
    vi.useRealTimers();
    await expect(trackLoading(Promise.resolve(7))).resolves.toBe(7);
    expect(state().pending).toBe(0);
    await expect(trackLoading(Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(state().pending).toBe(0);
  });

  it("tiến trình giả: tăng dần, chậm lại, không bao giờ chạm 100%", () => {
    let p = TRICKLE_START;
    const steps: number[] = [];
    for (let i = 0; i < 500; i++) {
      const next = trickle(p);
      expect(next).toBeGreaterThanOrEqual(p);
      steps.push(next - p);
      p = next;
    }
    expect(p).toBeLessThanOrEqual(TRICKLE_MAX);
    expect(p).toBeLessThan(1);
    // Bước đầu lớn hơn bước sau (nhanh rồi chậm dần).
    expect(steps[0]).toBeGreaterThan(steps[10] ?? 0);
  });
});
