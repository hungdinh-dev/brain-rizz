import { describe, expect, it } from "vitest";
import { parseOAuthReturn } from "./supabase";

describe("parseOAuthReturn", () => {
  it("URL thường → không phải lượt quay về", () => {
    expect(parseOAuthReturn("http://localhost:5173/")).toEqual({
      hasCode: false,
      error: null,
      cleanedUrl: null,
    });
  });

  it("PKCE ?code= → để supabase-js tự xử lý, không đổi URL", () => {
    const out = parseOAuthReturn("http://localhost:5173/?code=abc");
    expect(out.hasCode).toBe(true);
    expect(out.cleanedUrl).toBeNull();
  });

  it("Google đã gắn tài khoản khác (luồng rẽ 3a) → mã lỗi, URL bỏ tham số lỗi", () => {
    const out = parseOAuthReturn(
      "http://localhost:5173/?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked",
    );
    expect(out.error).toEqual({
      code: "identity_already_exists",
      description: "Identity is already linked",
    });
    expect(out.cleanedUrl).toBe("http://localhost:5173/");
  });

  it("lỗi nằm ở hash, giữ tham số khác", () => {
    const out = parseOAuthReturn(
      "http://localhost:5173/r/ABCD?x=1#error=access_denied&error_description=cancel&foo=bar",
    );
    expect(out.error?.code).toBe("access_denied");
    expect(out.cleanedUrl).toBe("http://localhost:5173/r/ABCD?x=1#foo=bar");
  });
});
