import { describe, expect, it } from "vitest";
import { buildTracks, nextTrackIndex, trackIndexOf, trackTitleFromPath } from "./tracks";

describe("trackTitleFromPath", () => {
  it("bỏ thư mục, đuôi, tiền tố số; kebab → Title Case", () => {
    expect(trackTitleFromPath("../../assets/music/01-happy-chalk.mp3")).toBe("Happy Chalk");
  });

  it("snake_case, nhiều kiểu tiền tố số", () => {
    expect(trackTitleFromPath("2_brain_party.ogg")).toBe("Brain Party");
    expect(trackTitleFromPath("10. lofi  study.m4a")).toBe("Lofi Study");
  });

  it("không có tiền tố số thì giữ nguyên chữ, chỉ viết hoa chữ đầu", () => {
    expect(trackTitleFromPath("chill-DJ-mix.mp3")).toBe("Chill DJ Mix");
    expect(trackTitleFromPath("8bit-dance.mp3")).toBe("8bit Dance");
  });

  it("chỉ có số → giữ tên không đuôi", () => {
    expect(trackTitleFromPath("01.mp3")).toBe("01");
  });
});

describe("buildTracks", () => {
  it("rỗng → danh sách rỗng", () => {
    expect(buildTracks({})).toEqual([]);
  });

  it("sắp theo tên file, số tự nhiên (2 trước 10)", () => {
    const tracks = buildTracks({
      "../../assets/music/10-last.mp3": "/a/10.mp3",
      "../../assets/music/02-second.mp3": "/a/02.mp3",
      "../../assets/music/1-first.mp3": "/a/1.mp3",
    });
    expect(tracks.map((t) => t.id)).toEqual(["1-first.mp3", "02-second.mp3", "10-last.mp3"]);
    expect(tracks[0]).toEqual({ id: "1-first.mp3", title: "First", url: "/a/1.mp3" });
  });
});

describe("nextTrackIndex", () => {
  it("sang bài kế, hết danh sách quay về đầu", () => {
    expect(nextTrackIndex(0, 3)).toBe(1);
    expect(nextTrackIndex(1, 3)).toBe(2);
    expect(nextTrackIndex(2, 3)).toBe(0);
  });

  it("một bài → luôn bài đó", () => {
    expect(nextTrackIndex(0, 1)).toBe(0);
  });

  it("danh sách rỗng → -1", () => {
    expect(nextTrackIndex(0, 0)).toBe(-1);
    expect(nextTrackIndex(-1, 0)).toBe(-1);
  });

  it("vị trí lạ → về bài đầu", () => {
    expect(nextTrackIndex(-1, 3)).toBe(0);
    expect(nextTrackIndex(7, 3)).toBe(0);
    expect(nextTrackIndex(Number.NaN, 3)).toBe(0);
  });
});

describe("trackIndexOf", () => {
  const tracks = buildTracks({ "a/01-a.mp3": "/a", "a/02-b.mp3": "/b" });

  it("tìm đúng bài đã lưu", () => {
    expect(trackIndexOf(tracks, "02-b.mp3")).toBe(1);
  });

  it("bài đã bị xoá hoặc chưa lưu → bài đầu", () => {
    expect(trackIndexOf(tracks, "99-gone.mp3")).toBe(0);
    expect(trackIndexOf(tracks, null)).toBe(0);
  });

  it("danh sách rỗng → -1", () => {
    expect(trackIndexOf([], "01-a.mp3")).toBe(-1);
  });
});
