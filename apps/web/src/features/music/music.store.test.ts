import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "./tracks";

/*
 * Test store nhạc nền với thẻ audio giả (môi trường node, không có DOM):
 * nhảy bài khi hết/lỗi, dừng khi lỗi hết danh sách, ẩn/hiện tab, nhỏ tiếng, nối Web Audio một lần.
 */

const mockTracks = vi.hoisted(() => ({ list: [] as Track[] }));
vi.mock("./track-list", () => ({
  get TRACKS() {
    return mockTracks.list;
  },
}));

/** Thẻ audio giả: play() thành công (hoặc bị chặn khi `blocked`), phát sự kiện như trình duyệt. */
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static blocked = false;
  paused = true;
  volume = 1;
  preload = "";
  playCalls = 0;
  private srcAttr: string | null = null;
  constructor() {
    super();
    FakeAudio.instances.push(this);
  }
  get src() {
    return this.srcAttr ?? "";
  }
  set src(v: string) {
    this.srcAttr = v;
  }
  getAttribute(name: string) {
    return name === "src" ? this.srcAttr : null;
  }
  play() {
    this.playCalls += 1;
    if (FakeAudio.blocked) return Promise.reject(new Error("NotAllowedError"));
    if (this.paused) {
      this.paused = false;
      this.dispatchEvent(new Event("play"));
    }
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  fire(type: string) {
    if (type === "ended" || type === "error") this.paused = true;
    this.dispatchEvent(new Event(type));
  }
}

const track = (n: number): Track => ({ id: `0${n}-t.mp3`, title: `T${n}`, url: `/m/0${n}.mp3` });

async function loadStore() {
  vi.resetModules();
  return import("./music.store");
}

function lastAudio() {
  const el = FakeAudio.instances.at(-1);
  if (!el) throw new Error("chưa tạo thẻ audio");
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.blocked = false;
  mockTracks.list = [track(1), track(2), track(3)];
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  vi.stubGlobal("Audio", FakeAudio);
  // Không có AudioContext → đường dự phòng audio.volume
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("music.store", () => {
  it("nạp module không tạo thẻ audio (chỉ tạo khi phát lần đầu)", async () => {
    await loadStore();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("danh sách rỗng → index -1, phát không làm gì", async () => {
    mockTracks.list = [];
    const { useMusic, resumeMusicIfEnabled } = await loadStore();
    expect(useMusic.getState().index).toBe(-1);
    await expect(resumeMusicIfEnabled()).resolves.toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("hết bài → sang bài kế, hết danh sách quay về bài đầu", async () => {
    const { useMusic } = await loadStore();
    useMusic.getState().play();
    const el = lastAudio();
    expect(el.getAttribute("src")).toBe("/m/01.mp3");
    el.fire("ended");
    expect(useMusic.getState().index).toBe(1);
    expect(el.getAttribute("src")).toBe("/m/02.mp3");
    el.fire("ended");
    el.fire("ended");
    expect(useMusic.getState().index).toBe(0);
    expect(useMusic.getState().playing).toBe(true);
  });

  it("mọi bài đều lỗi → thử mỗi bài một lần rồi dừng, không lặp vô hạn", async () => {
    const { useMusic } = await loadStore();
    useMusic.getState().play();
    const el = lastAudio();
    const before = el.playCalls;
    for (let i = 0; i < 10; i++) el.fire("error");
    // 3 bài: lỗi lần 1, 2 nhảy bài (2 lần play), lỗi lần 3 thì dừng
    expect(el.playCalls - before).toBe(2);
    expect(useMusic.getState().playing).toBe(false);
  });

  it("lỗi hết danh sách → thẻ audio dừng hẳn; bấm Phát → thử lại từ bài hiện tại, đếm lỗi về 0", async () => {
    const { useMusic } = await loadStore();
    useMusic.getState().play();
    const el = lastAudio();
    // Trình duyệt thật: thẻ lỗi có thể vẫn paused=false → store phải tự pause().
    const failKeepPlaying = () => {
      el.dispatchEvent(new Event("error"));
    };
    failKeepPlaying();
    failKeepPlaying();
    failKeepPlaying();
    expect(el.paused).toBe(true);
    expect(useMusic.getState().playing).toBe(false);
    const stoppedAt = useMusic.getState().index;

    const calls = el.playCalls;
    useMusic.getState().toggle();
    expect(el.playCalls).toBe(calls + 1);
    expect(useMusic.getState().index).toBe(stoppedAt);
    expect(useMusic.getState().playing).toBe(true);
    // Bộ đếm mới: một lỗi nữa thì nhảy bài chứ không dừng
    el.fire("error");
    expect(useMusic.getState().index).toBe((stoppedAt + 1) % 3);
  });

  it("kéo âm lượng chỉ đổi ngay, thả tay mới ghi vào máy", async () => {
    const { useMusic } = await loadStore();
    const writes = vi.spyOn(localStorage, "setItem");
    useMusic.getState().setVolume(0.2);
    useMusic.getState().setVolume(0.25);
    useMusic.getState().setVolume(0.3);
    expect(useMusic.getState().volume).toBe(0.3);
    expect(writes).not.toHaveBeenCalled();
    useMusic.getState().commitVolume();
    expect(writes).toHaveBeenCalledTimes(1);
    const reloaded = (await loadStore()).useMusic;
    expect(reloaded.getState().volume).toBe(0.3);
  });

  it("một bài lỗi rồi bài sau phát được → đếm lỗi về 0", async () => {
    const { useMusic } = await loadStore();
    useMusic.getState().play();
    const el = lastAudio();
    el.fire("error");
    el.fire("playing");
    el.fire("error");
    el.fire("error");
    // Sau "playing" đếm lại: 2 lỗi < 3 bài → vẫn nhảy bài
    expect(useMusic.getState().index).toBe(0);
  });

  it("nhớ bật/tắt, âm lượng và bài đang nghe qua lần mở trang sau", async () => {
    let s = (await loadStore()).useMusic;
    s.getState().play();
    s.getState().next();
    s.getState().setVolume(0.3);
    s.getState().pause();
    s = (await loadStore()).useMusic;
    expect(s.getState()).toMatchObject({ enabled: false, volume: 0.3, index: 1, playing: false });
  });

  it("đã tắt nhạc → thao tác đầu tiên không tự phát", async () => {
    const { useMusic, resumeMusicIfEnabled } = await loadStore();
    useMusic.getState().pause();
    await expect(resumeMusicIfEnabled()).resolves.toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("trình duyệt chặn tự phát → trả false, không ném lỗi", async () => {
    FakeAudio.blocked = true;
    const { resumeMusicIfEnabled, useMusic } = await loadStore();
    await expect(resumeMusicIfEnabled()).resolves.toBe(false);
    expect(useMusic.getState().playing).toBe(false);
  });

  it("ẩn tab lúc đang phát → dừng; hiện lại → phát tiếp", async () => {
    const { useMusic, suspendMusic, resumeMusicAfterHidden } = await loadStore();
    useMusic.getState().play();
    const el = lastAudio();
    suspendMusic();
    expect(el.paused).toBe(true);
    expect(useMusic.getState().enabled).toBe(true);
    resumeMusicAfterHidden();
    await flush();
    expect(el.paused).toBe(false);
  });

  it("ẩn tab lúc không phát → hiện lại không tự phát", async () => {
    const { useMusic, suspendMusic, resumeMusicAfterHidden } = await loadStore();
    useMusic.getState().play();
    useMusic.getState().pause();
    const el = lastAudio();
    const calls = el.playCalls;
    suspendMusic();
    resumeMusicAfterHidden();
    expect(el.playCalls).toBe(calls);
    expect(el.paused).toBe(true);
  });

  it("không có AudioContext: nhỏ còn một nửa qua audio.volume khi đếm ngược/chơi", async () => {
    const { useMusic } = await loadStore();
    useMusic.getState().setVolume(0.8);
    useMusic.getState().play();
    const el = lastAudio();
    expect(el.volume).toBeCloseTo(0.8);
    useMusic.getState().setDucked(true);
    expect(el.volume).toBeCloseTo(0.4);
    useMusic.getState().setDucked(false);
    expect(el.volume).toBeCloseTo(0.8);
  });

  it("có AudioContext: nối Web Audio đúng một lần, gain giảm còn một nửa, thẻ audio để 1", async () => {
    const sources: unknown[] = [];
    const gainCalls: number[] = [];
    class FakeContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createMediaElementSource(el: unknown) {
        sources.push(el);
        return { connect() {} };
      }
      createGain() {
        return {
          connect() {},
          gain: {
            cancelScheduledValues() {},
            setValueAtTime: (v: number) => void gainCalls.push(v),
            setTargetAtTime: (v: number) => void gainCalls.push(v),
          },
        };
      }
      resume() {
        return Promise.resolve();
      }
      suspend() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("window", { AudioContext: FakeContext });
    const { useMusic } = await loadStore();
    useMusic.getState().setVolume(0.6);
    useMusic.getState().play();
    useMusic.getState().pause();
    useMusic.getState().play();
    useMusic.getState().next();
    expect(sources).toHaveLength(1);
    expect(FakeAudio.instances).toHaveLength(1);
    useMusic.getState().setDucked(true);
    expect(gainCalls.at(-1)).toBeCloseTo(0.3);
    expect(lastAudio().volume).toBe(1);
  });
});
