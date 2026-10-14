import { describe, expect, it } from "vitest";
import { gestureAction } from "./gesture";

describe("gestureAction", () => {
  it("bấm chỗ trống khi nhạc đang bật mà chưa phát → phát", () => {
    expect(gestureAction({ enabled: true, playing: false, onControl: false })).toBe("play");
  });

  it("thao tác trên thanh nhạc (vd. kéo âm lượng) → bỏ qua nhưng vẫn chờ tiếp", () => {
    expect(gestureAction({ enabled: true, playing: false, onControl: true })).toBe("ignore");
  });

  it("đã tắt nhạc hoặc đã phát → thôi chờ", () => {
    expect(gestureAction({ enabled: false, playing: false, onControl: false })).toBe("stop");
    expect(gestureAction({ enabled: true, playing: true, onControl: false })).toBe("stop");
    expect(gestureAction({ enabled: true, playing: true, onControl: true })).toBe("stop");
  });
});
