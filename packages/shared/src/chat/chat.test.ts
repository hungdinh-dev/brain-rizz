import { describe, expect, it } from "vitest";
import {
  CHAT_HISTORY_SIZE,
  CHAT_MAX_LENGTH,
  CHAT_PHASES,
  CHAT_RATE,
  isChatPhase,
} from "./constants";
import { filterProfanity, hasProfanity, PROFANITY_MASK } from "./profanity";
import { consumeToken, createChatRateLimiter } from "./rate-limit";
import { sanitizeChatText, truncateCodePoints } from "./sanitize";

describe("hằng số chat (CR-011)", () => {
  it("giới hạn đã chốt", () => {
    expect(CHAT_MAX_LENGTH).toBe(120);
    expect(CHAT_HISTORY_SIZE).toBe(30);
    expect(CHAT_RATE).toEqual({ burst: 3, refillMs: 1_000 });
  });

  it("chat ở mọi pha trừ đếm ngược và đang chơi", () => {
    expect([...CHAT_PHASES]).toEqual([
      "lobby",
      "game-select",
      "game-intro",
      "round-results",
      "podium",
    ]);
    expect(isChatPhase("lobby")).toBe(true);
    expect(isChatPhase("countdown")).toBe(false);
    expect(isChatPhase("playing")).toBe(false);
  });
});

describe("filterProfanity", () => {
  it("che từ tục tiếng Anh, không phân biệt hoa thường", () => {
    expect(filterProfanity("what the FUCK")).toBe(`what the ${PROFANITY_MASK}`);
    expect(filterProfanity("Shit happens")).toBe("*** happens");
    expect(filterProfanity("you BiTcH!")).toBe("you ***!");
  });

  it("che các dạng có đuôi của gốc có dấu *", () => {
    expect(filterProfanity("fucking hard")).toBe("*** hard");
    expect(filterProfanity("motherfucker")).toBe("***");
    expect(filterProfanity("fuckers")).toBe("***");
  });

  it("che từ tục tiếng Việt có dấu, cả chữ hoa", () => {
    expect(filterProfanity("đồ cặc")).toBe("đồ ***");
    expect(filterProfanity("ĐÉO chơi nữa")).toBe("*** chơi nữa");
    expect(filterProfanity("vãi lồn thật")).toBe("vãi *** thật");
    expect(filterProfanity("Địt")).toBe("***");
  });

  it("cụm nhiều từ: cách bằng khoảng trắng hoặc viết liền", () => {
    expect(filterProfanity("thằng chó đẻ")).toBe("thằng ***");
    expect(filterProfanity("thằng chóđẻ")).toBe("thằng ***");
    expect(filterProfanity("dit me may")).toBe("*** may");
    expect(filterProfanity("ditme")).toBe("***");
  });

  it("viết tắt không dấu: khớp cả khi có dấu, viết hoa", () => {
    expect(filterProfanity("vcl thật")).toBe("*** thật");
    expect(filterProfanity("VCL")).toBe("***");
    expect(filterProfanity("đm nó")).toBe("*** nó");
    expect(filterProfanity("ĐMM")).toBe("***");
    expect(filterProfanity("dcm")).toBe("***");
  });

  it("lách bằng dấu chấm, gạch, gạch dưới, sao", () => {
    expect(filterProfanity("f.u.c.k you")).toBe("*** you");
    expect(filterProfanity("s_h_i_t")).toBe("***");
    expect(filterProfanity("đ-m")).toBe("***");
    expect(filterProfanity("v.c.l")).toBe("***");
    expect(filterProfanity("c.ặ.c")).toBe("***");
  });

  it("lách bằng khoảng trắng giữa các chữ đơn", () => {
    expect(filterProfanity("f u c k")).toBe("***");
    expect(filterProfanity("ôi đ m")).toBe("ôi ***");
    expect(filterProfanity("a s s hole")).toBe("*** hole");
  });

  it("leet cơ bản", () => {
    expect(filterProfanity("sh1t")).toBe("***");
    expect(filterProfanity("@$$")).toBe("***");
    expect(filterProfanity("b1tch")).toBe("***");
    expect(filterProfanity("fvck")).toBe("fvck"); // ngoài danh sách leet
    expect(filterProfanity("l0z")).toBe("***");
  });

  it("che đúng vị trí trong chuỗi có emoji", () => {
    expect(filterProfanity("😂 shit 😂")).toBe("😂 *** 😂");
    expect(filterProfanity("👨‍👩‍👧 vcl")).toBe("👨‍👩‍👧 ***");
  });

  it("ký tự vô hình giữa từ không giúp lách", () => {
    expect(filterProfanity("fu‍ck")).toBe("***");
  });

  it("chuỗi NFD (dấu tách rời) vẫn bị che như NFC", () => {
    expect(filterProfanity("cặc".normalize("NFD"))).toBe("***");
  });

  it("không che nhầm câu thường (Scunthorpe, từ trùng khi bỏ dấu)", () => {
    const clean = [
      "các bạn ơi",
      "Các Bạn",
      "đi thôi",
      "dĩ nhiên rồi",
      "buổi sáng vui",
      "uống lon bia",
      "đeo kính vào",
      "cút đi",
      "cụt hứng",
      "đích đến",
      "đc m ơi",
      "class assess passage",
      "Scunthorpe cocktail Dickens shitake",
      "glass hole",
      "như vậy là xong",
      "đụng độ",
      "GG",
      "3 2 1 đi",
      "",
    ];
    for (const text of clean) {
      expect(filterProfanity(text), text).toBe(text);
      expect(hasProfanity(text), text).toBe(false);
    }
  });

  it("hasProfanity", () => {
    expect(hasProfanity("f.u.c.k")).toBe(true);
    expect(hasProfanity("vui quá")).toBe(false);
  });
});

describe("sanitizeChatText", () => {
  it("gộp khoảng trắng, xuống dòng, trim", () => {
    expect(sanitizeChatText("  xin   chào \n\n bạn\t ")).toBe("xin chào bạn");
  });

  it("xoá ký tự điều khiển và vô hình, giữ emoji ghép", () => {
    expect(sanitizeChatText("a\u0000b​c‮d")).toBe("abcd");
    expect(sanitizeChatText("👨‍👩‍👧")).toBe("👨‍👩‍👧");
  });

  it("rỗng hoặc chỉ có khoảng trắng / ký tự vô hình → null", () => {
    expect(sanitizeChatText("")).toBeNull();
    expect(sanitizeChatText("   \n\t")).toBeNull();
    expect(sanitizeChatText("​\u0007")).toBeNull();
  });

  it("cắt còn 120 code point, không cắt đôi emoji", () => {
    expect(sanitizeChatText("a".repeat(200))).toBe("a".repeat(CHAT_MAX_LENGTH));
    const emoji = "😂".repeat(130);
    const out = sanitizeChatText(emoji) ?? "";
    expect(Array.from(out)).toHaveLength(CHAT_MAX_LENGTH);
    expect(out).toBe("😂".repeat(CHAT_MAX_LENGTH));
    expect(out.length).toBe(CHAT_MAX_LENGTH * 2);
  });

  it("lọc từ tục sau khi làm sạch, kết quả không quá 120 ký tự", () => {
    expect(sanitizeChatText("  vcl   quá ")).toBe("*** quá");
    const long = sanitizeChatText(`${"x".repeat(117)} dm`) ?? "";
    expect(Array.from(long).length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
    expect(long.endsWith("**")).toBe(true);
  });

  it("truncateCodePoints giữ nguyên chuỗi ngắn", () => {
    expect(truncateCodePoints("abc", 5)).toBe("abc");
    expect(truncateCodePoints("a😂b", 2)).toBe("a😂");
  });
});

describe("giới hạn tần suất (token bucket)", () => {
  it("cụm 3 tin rồi bị chặn, sau đó hồi 1 tin mỗi giây", () => {
    const limiter = createChatRateLimiter();
    const t0 = 1_000_000;
    expect([1, 2, 3, 4].map(() => limiter.consume("an", t0))).toEqual([true, true, true, false]);
    expect(limiter.consume("an", t0 + 999)).toBe(false);
    expect(limiter.consume("an", t0 + 1_000)).toBe(true);
    expect(limiter.consume("an", t0 + 1_500)).toBe(false);
    expect(limiter.consume("an", t0 + 2_000)).toBe(true);
    // Người khác có lượt riêng.
    expect(limiter.consume("binh", t0 + 2_000)).toBe(true);
  });

  it("nghỉ lâu thì hồi đầy nhưng không quá cụm 3", () => {
    const limiter = createChatRateLimiter();
    for (let i = 0; i < 3; i++) limiter.consume("an", 0);
    const later = 60_000;
    expect([1, 2, 3, 4].map(() => limiter.consume("an", later))).toEqual([true, true, true, false]);
  });

  it("forget xoá trạng thái (người rời phòng)", () => {
    const limiter = createChatRateLimiter();
    for (let i = 0; i < 3; i++) limiter.consume("an", 0);
    expect(limiter.consume("an", 0)).toBe(false);
    limiter.forget("an");
    expect(limiter.consume("an", 0)).toBe(true);
  });

  it("consumeToken thuần: bị từ chối không trừ lượt, giờ lùi không cộng lượt", () => {
    const first = consumeToken(undefined, 100);
    expect(first).toEqual({ ok: true, bucket: { creditMs: 2_000, at: 100 } });
    const denied = consumeToken({ creditMs: 500, at: 100 }, 100);
    expect(denied).toEqual({ ok: false, bucket: { creditMs: 500, at: 100 } });
    const back = consumeToken({ creditMs: 0, at: 5_000 }, 1_000);
    expect(back).toEqual({ ok: false, bucket: { creditMs: 0, at: 5_000 } });
  });
});
