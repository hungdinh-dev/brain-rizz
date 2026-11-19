import { emptyUnlockStats } from "@brain-rizz/shared";
import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { usePetUnlockStore } from "@/features/pets";
import { vi as viText } from "@/i18n/locales/vi";
import { CharacterPicker } from "./components/CharacterPicker";

/**
 * Đổi nhân vật ở phòng chờ (ui-ux 6.12): 12 nút, đã mở trước, thú khoá sau (xám + ổ khoá), bấm thú
 * khoá chỉ mở điều kiện — không có aria-pressed, không chọn được.
 */

vi.mock("@/net/unlocks-api", () => ({
  fetchUnlockStats: vi.fn(async () => ({ ok: false, reason: "not-configured" })),
}));
// Barrel `@/features/home` kéo theo HomeScreen + lớp kết nối (cần DOM): chỉ cần hồ sơ.
vi.mock("@/features/home", () => ({
  loadProfile: () => ({
    name: "QA",
    colorIndex: 0,
    avatar: "khoi",
    difficulty: 1,
    accessories: [],
  }),
  saveProfile: vi.fn(),
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: viText } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

/**
 * renderToStaticMarkup đọc server snapshot của zustand = trạng thái lúc tạo store, nên ghi trạng thái
 * cần thử vào cả hai.
 */
function setUnlocks(patch: Partial<ReturnType<typeof usePetUnlockStore.getState>>) {
  usePetUnlockStore.setState(patch);
  Object.assign(usePetUnlockStore.getInitialState(), usePetUnlockStore.getState());
}

describe("chọn nhân vật ở phòng chờ có thú khoá", () => {
  it("6 cũ + thú đã mở chọn được; thú khoá xếp cuối, mở điều kiện", () => {
    setUnlocks({
      load: "ready",
      stats: { ...emptyUnlockStats(), brainBest: 600 },
      fromServer: true,
      seen: ["may"],
    });
    const html = renderToStaticMarkup(<CharacterPicker value="bo" onChange={() => {}} />);
    expect(count(html, 'aria-pressed="')).toBe(7);
    expect(count(html, 'aria-haspopup="dialog"')).toBe(5);
    expect(html).toContain('aria-label="Chọn Mây"');
    expect(html).toContain('aria-label="Pin, chưa mở khoá — xem cách mở"');
    // Mây (đã mở) đứng trước mọi thú khoá.
    expect(html.indexOf("Chọn Mây")).toBeLessThan(html.indexOf("Pin, chưa mở khoá"));
    expect(count(html, "grayscale")).toBe(5);
  });
});
