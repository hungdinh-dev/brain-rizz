import { create } from "zustand";
import { type AudioOutput, createAudioOutput } from "./audio-output";
import { clampVolume, loadMusicSettings, type MusicSettings, saveMusicSettings } from "./settings";
import { TRACKS } from "./track-list";
import { nextTrackIndex, trackIndexOf } from "./tracks";

/**
 * Nhạc nền: một thẻ <audio> dùng chung cho cả app (không thư viện), phát lần lượt các bài trong
 * `src/assets/music/`, hết danh sách quay về bài đầu. Thẻ audio chỉ được tạo và tải nhạc khi phát lần đầu.
 * Âm lượng đi qua `audio-output.ts` (GainNode của Web Audio) để chỉnh được cả trên iPhone.
 */

interface MusicStore {
  /** Người chơi muốn nghe nhạc (được nhớ). */
  enabled: boolean;
  /** Âm lượng người chọn 0–1 (được nhớ). */
  volume: number;
  /** Vị trí bài hiện tại trong TRACKS, -1 khi không có bài nào. */
  index: number;
  /** Thẻ audio đang phát thật (theo sự kiện play/pause). */
  playing: boolean;
  /** Đang đếm ngược/chơi → nhạc nhỏ lại. */
  ducked: boolean;
  /** Người chơi bấm phát: bật hẳn nhạc và phát. */
  play(): void;
  /** Người chơi bấm dừng: tắt hẳn, lần sau mở trang cũng không tự phát. */
  pause(): void;
  toggle(): void;
  /** Sang bài kế (quay vòng) và phát. */
  next(): void;
  /** Đổi âm lượng ngay (kéo thanh trượt) — chưa ghi vào máy. */
  setVolume(volume: number): void;
  /** Thả thanh trượt: ghi âm lượng vào máy (không ghi mỗi bước kéo). */
  commitVolume(): void;
  setDucked(ducked: boolean): void;
}

const saved = loadMusicSettings();

let audio: HTMLAudioElement | null = null;
/** Đường ra loa (Web Audio nếu có) — tạo cùng lúc với thẻ audio, trong thao tác đầu tiên của người chơi. */
let output: AudioOutput | null = null;
/** Số bài lỗi liên tiếp — lỗi hết cả danh sách thì thôi, không nhảy bài mãi. */
let errorStreak = 0;
/** Tab bị ẩn lúc đang phát → hiện lại thì phát tiếp. */
let resumeOnShow = false;

function persist() {
  const { enabled, volume, index } = useMusic.getState();
  const settings: MusicSettings = { enabled, volume, trackId: TRACKS[index]?.id ?? null };
  saveMusicSettings(settings);
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = "none";
  el.addEventListener("play", () => useMusic.setState({ playing: true }));
  el.addEventListener("pause", () => useMusic.setState({ playing: false }));
  el.addEventListener("playing", () => {
    errorStreak = 0;
  });
  el.addEventListener("ended", () => advance(true));
  el.addEventListener("error", () => {
    errorStreak += 1;
    if (errorStreak < TRACKS.length) {
      advance(true);
      return;
    }
    // Lỗi hết cả danh sách: dừng hẳn (thẻ lỗi có thể vẫn paused=false) để nút hiện đúng "Phát".
    el.pause();
    useMusic.setState({ playing: false });
  });
  audio = el;
  output = createAudioOutput(el);
  return el;
}

/**
 * Phát bài đang chọn. Trả về true nếu trình duyệt cho phát; bị chặn tự phát (chưa có thao tác
 * của người chơi) hay lỗi tải thì nuốt lỗi, trả false — không hiện gì cho người chơi.
 */
async function startPlayback(): Promise<boolean> {
  const { index, volume, ducked } = useMusic.getState();
  const track = TRACKS[index];
  if (!track) return false;
  const el = getAudio();
  // So bằng getAttribute: thuộc tính .src trả về URL tuyệt đối, khác chuỗi Vite cấp.
  if (el.getAttribute("src") !== track.url) el.src = track.url;
  // Cùng bài nhưng lần trước tải lỗi → phải load() lại thì play() mới thử tải lần nữa.
  else if (el.error) el.load();
  // Đồng bộ, trước await: resume AudioContext phải nằm trong thao tác của người chơi.
  output?.wake();
  output?.setLevel(volume, ducked, false);
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

function advance(autoplay: boolean) {
  const { index } = useMusic.getState();
  const nextIndex = nextTrackIndex(index, TRACKS.length);
  if (nextIndex < 0) return;
  useMusic.setState({ index: nextIndex });
  persist();
  if (autoplay) void startPlayback();
}

export const useMusic = create<MusicStore>((set, get) => ({
  enabled: saved.enabled,
  volume: saved.volume,
  index: trackIndexOf(TRACKS, saved.trackId),
  playing: false,
  ducked: false,
  play() {
    set({ enabled: true });
    persist();
    // Bấm Phát sau khi cả danh sách lỗi → thử lại từ bài hiện tại với bộ đếm mới.
    errorStreak = 0;
    void startPlayback();
  },
  pause() {
    set({ enabled: false });
    persist();
    resumeOnShow = false;
    audio?.pause();
  },
  toggle() {
    if (get().playing) get().pause();
    else get().play();
  },
  next() {
    set({ enabled: true });
    advance(true);
  },
  setVolume(volume) {
    set({ volume: clampVolume(volume) });
    output?.setLevel(get().volume, get().ducked, false);
  },
  commitVolume() {
    persist();
  },
  setDucked(ducked) {
    if (ducked === get().ducked) return;
    set({ ducked });
    output?.setLevel(get().volume, ducked, true);
  },
}));

/** Thao tác đầu tiên trên trang: phát nếu người chơi chưa tắt nhạc. Không đổi lựa chọn đã lưu. */
export function resumeMusicIfEnabled(): Promise<boolean> {
  const { enabled, playing } = useMusic.getState();
  if (!enabled) return Promise.resolve(false);
  if (playing) return Promise.resolve(true);
  return startPlayback();
}

/** Tab bị ẩn: tạm dừng, nhớ để phát tiếp khi hiện lại. */
export function suspendMusic() {
  if (!audio || audio.paused) return;
  resumeOnShow = true;
  audio.pause();
  output?.sleep();
}

/**
 * Mỗi thao tác của người chơi: nhạc đang phát mà AudioContext bị ngưng (iOS khoá máy, cuộc gọi,
 * hiện lại tab ngoài thao tác) thì resume — nếu không, nhạc chạy mà không ra tiếng.
 */
export function wakeMusicOutput() {
  if (audio && !audio.paused) output?.wake();
}

/** Tab hiện lại: phát tiếp nếu lúc ẩn đang phát và người chơi vẫn bật nhạc. */
export function resumeMusicAfterHidden() {
  if (!resumeOnShow) return;
  resumeOnShow = false;
  if (useMusic.getState().enabled) void startPlayback();
}
