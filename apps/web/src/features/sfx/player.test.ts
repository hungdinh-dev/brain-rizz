import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Test phát sfx với AudioContext giả (môi trường node): tải trước file khi mở khoá,
 * phát từ file nếu đã giải mã, không thì tiếng tổng hợp; chưa mở khoá / tắt → im.
 */

const mock = vi.hoisted(() => ({
  urls: {} as Record<string, string>,
  ctx: null as unknown,
}));
vi.mock("./sfx-files", () => ({
  get SFX_URLS() {
    return mock.urls;
  },
}));
vi.mock("@/lib/audio-context", () => ({
  peekAudioContext: () => mock.ctx,
}));

const param = () => ({
  value: 0,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
});

class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  oscillators = 0;
  bufferSources = 0;
  decoded: unknown[] = [];
  createGain() {
    return { gain: param(), connect() {} };
  }
  createOscillator() {
    this.oscillators += 1;
    return { type: "", frequency: param(), connect() {}, start() {}, stop() {} };
  }
  createBufferSource() {
    this.bufferSources += 1;
    return { buffer: null, playbackRate: param(), connect() {}, start() {} };
  }
  decodeAudioData(data: ArrayBuffer) {
    this.decoded.push(data);
    return Promise.resolve({ duration: 0.1 });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function loadPlayer() {
  vi.resetModules();
  return import("./player");
}

let ctx: FakeContext;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ctx = new FakeContext();
  mock.ctx = ctx;
  mock.urls = { click: "/sfx/click.mp3" };
  fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("player", () => {
  it("mở khoá → tải trước file; tiếng đầu tiên đã phát từ file", async () => {
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/sfx/click.mp3");
    await flush();
    playSfx("click");
    expect(ctx.bufferSources).toBe(1);
    expect(ctx.oscillators).toBe(0);
  });

  it("tải trước nhiều lần / phát nhiều lần → mỗi file chỉ tải một lần", async () => {
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    preloadSfx();
    playSfx("click");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loại không có file → tiếng tổng hợp", async () => {
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    await flush();
    playSfx("toggle");
    expect(ctx.bufferSources).toBe(0);
    expect(ctx.oscillators).toBe(2);
  });

  it("tải lỗi → bỏ qua, dùng tiếng tổng hợp, không ném lỗi", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    await flush();
    expect(() => playSfx("click")).not.toThrow();
    expect(ctx.bufferSources).toBe(0);
    expect(ctx.oscillators).toBe(1);
  });

  it("chưa có context → không tải, không phát", async () => {
    mock.ctx = null;
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    playSfx("click");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("context chưa chạy (chưa mở khoá) → im, không xếp tiếng", async () => {
    ctx.state = "suspended";
    const { playSfx } = await loadPlayer();
    playSfx("tick");
    expect(ctx.oscillators).toBe(0);
  });
});
