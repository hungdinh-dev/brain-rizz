import { describe, expect, it } from "vitest";
import { DEVICE_LABEL_MAX, deviceLabel } from "./device-label";

describe("deviceLabel (CR-019)", () => {
  const cases: [string, string, number?][] = [
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Chrome · Android",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      "Safari · iOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
      "Chrome · iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Edge · Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
      "Firefox · Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      "Safari · macOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      "Samsung Internet · Android",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Chrome · ChromeOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/134.0.200 Chrome/128.0.0.0 Safari/537.36",
      "Cốc Cốc · Windows",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; V2109) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 Zalo android/12100658 ZaloTheme/light ZaloLanguage/vi",
      "Zalo · Android",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Chrome · Linux",
    ],
  ];

  it.each(cases)("%s → %s", (ua, expected) => {
    expect(deviceLabel(ua)).toBe(expected);
  });

  it("iPad đời mới khai là Macintosh: nhận ra nhờ màn cảm ứng", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
    expect(deviceLabel(ua, 5)).toBe("Safari · iPadOS");
    expect(deviceLabel(ua, 0)).toBe("Safari · macOS");
  });

  it("không nhận ra gì → chuỗi rỗng; nhận ra một nửa → chỉ phần đó", () => {
    expect(deviceLabel("")).toBe("");
    expect(deviceLabel("curl/8.4.0")).toBe("");
    expect(deviceLabel("SomeBot/1.0 (Windows NT 10.0)")).toBe("Windows");
  });

  it("không bao giờ dài quá giới hạn cột", () => {
    expect(deviceLabel(`${"x".repeat(5_000)} Chrome/1 Android`).length).toBeLessThanOrEqual(
      DEVICE_LABEL_MAX,
    );
  });
});
