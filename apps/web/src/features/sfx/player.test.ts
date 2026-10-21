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
  /** Mốc `start(when)` của mọi nguồn âm đã xếp (undefined = gọi `start()` không mốc). */
  starts: (number | undefined)[] = [];
  createGain() {
    return { gain: param(), connect() {} };
  }
  createOscillator() {
    this.oscillators += 1;
    const starts = this.starts;
    return {
      type: "",
      frequency: param(),
      detune: param(),
      connect() {},
      start(when?: number) {
        starts.push(when);
      },
      stop() {},
    };
  }
  createBufferSource() {
    this.bufferSources += 1;
    const starts = this.starts;
    return {
      buffer: null,
      playbackRate: param(),
      connect() {},
      start(when?: number) {
        starts.push(when);
      },
      stop() {},
    };
  }
  createBiquadFilter() {
    return { type: "", frequency: param(), Q: param(), connect() {} };
  }
  createBuffer(_channels: number, length: number) {
    return { sampleRate: 48_000, getChannelData: () => new Float32Array(length) };
  }
  sampleRate = 48_000;
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
    const { playSfx, sfxNow } = await loadPlayer();
    playSfx("tick");
    expect(ctx.oscillators).toBe(0);
    expect(sfxNow()).toBeNull();
  });

  it("when: xếp lịch theo đồng hồ AudioContext; không có when hay mốc đã qua → phát ngay", async () => {
    ctx.currentTime = 10;
    const { playSfx, sfxNow } = await loadPlayer();
    expect(sfxNow()).toBe(10);
    // Tiếng tổng hợp: mọi giọng của trống bắt đầu đúng mốc đã hẹn.
    playSfx("drum-low", { when: 10.75 });
    expect(ctx.starts.length).toBeGreaterThan(0);
    for (const t of ctx.starts) expect(t).toBeCloseTo(10.75, 6);
    ctx.starts = [];
    playSfx("drum-high", { when: 3 });
    for (const t of ctx.starts) expect(t).toBeCloseTo(10.005, 6);
    ctx.starts = [];
    playSfx("tick");
    expect(ctx.starts).toEqual([10.005]);
  });

  it("when với tiếng từ file: start(when)", async () => {
    mock.urls = { "drum-low": "/sfx/drum-low.mp3" };
    const { preloadSfx, playSfx } = await loadPlayer();
    preloadSfx();
    await flush();
    playSfx("drum-low", { when: 2.5 });
    expect(ctx.bufferSources).toBe(1);
    expect(ctx.starts).toEqual([2.5]);
  });

  it("sfx đã tắt → sfxNow null, không phát", async () => {
    const { playSfx, sfxNow } = await loadPlayer();
    const { useSfx } = await import("./sfx.store");
    useSfx.setState({ enabled: false });
    expect(sfxNow()).toBeNull();
    playSfx("drum-low", { when: 1 });
    expect(ctx.starts).toEqual([]);
    useSfx.setState({ enabled: true });
  });
});
