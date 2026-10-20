import { CHAT_MAX_LENGTH } from "@brain-rizz/shared";
import { afterEach, describe, expect, it } from "vitest";
import { limitChatText } from "./limit-text";

describe("limitChatText", () => {
  it("chưa quá giới hạn thì giữ nguyên", () => {
    expect(limitChatText("xin chào", 10)).toBe("xin chào");
    expect(limitChatText("😂".repeat(CHAT_MAX_LENGTH), CHAT_MAX_LENGTH)).toBe(
      "😂".repeat(CHAT_MAX_LENGTH),
    );
  });

  it("đếm emoji là 1 ký tự (code point), không phải 2 đơn vị UTF-16", () => {
    const text = "😂".repeat(CHAT_MAX_LENGTH + 5);
    const out = limitChatText(text, CHAT_MAX_LENGTH);
    expect(Array.from(out)).toHaveLength(CHAT_MAX_LENGTH);
    expect(out).toBe("😂".repeat(CHAT_MAX_LENGTH));
  });

  it("không cắt đôi emoji hay cụm ký tự ở biên", () => {
    // "ab" + emoji gia đình (5 code point nối ZWJ): giới hạn 4 → bỏ cả cụm, không để nửa cặp surrogate.
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    const out = limitChatText(`ab${family}`, 4);
    expect(out).toBe("ab");
    expect(out).not.toMatch(/[\uD800-\uDFFF]/);
  });

  it("tiếng Việt có dấu: kết quả không vượt quá giới hạn code point", () => {
    const out = limitChatText("đồng hồ ".repeat(30), CHAT_MAX_LENGTH);
    expect(Array.from(out).length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
    expect(Array.from(out).length).toBeGreaterThan(CHAT_MAX_LENGTH - 3);
  });
});

describe("limitChatText — cụm ký tự ở biên", () => {
  const family = "\u{1F468}‍\u{1F469}‍\u{1F467}"; // 5 code point

  it("cụm ZWJ vừa khít giới hạn thì giữ nguyên cả cụm", () => {
    expect(limitChatText(`ab${family}c`, 7)).toBe(`ab${family}`);
  });

  it("dấu tổ hợp (tiếng Việt dạng tách) không bị tách khỏi chữ gốc", () => {
    // "é" dạng tách = "e" + U+0301 (2 code point): giới hạn 3 → bỏ cả "é", không để "e" trơ.
    expect(limitChatText("abé", 3)).toBe("ab");
  });

  it("cờ quốc gia (2 regional indicator) không bị cắt một nửa", () => {
    expect(limitChatText("a\u{1F1FB}\u{1F1F3}", 2)).toBe("a");
  });
});

describe("limitChatText — trình duyệt không có Intl.Segmenter", () => {
  const original = Intl.Segmenter;

  afterEach(() => {
    Object.defineProperty(Intl, "Segmenter", {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it("cắt theo code point, không để nửa cặp surrogate", () => {
    Object.defineProperty(Intl, "Segmenter", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const out = limitChatText("😂".repeat(CHAT_MAX_LENGTH + 5), CHAT_MAX_LENGTH);
    expect(out).toBe("😂".repeat(CHAT_MAX_LENGTH));
    expect(limitChatText("a😂😂", 2)).toBe("a😂");
    expect(limitChatText("xin chào", 10)).toBe("xin chào");
  });
});
