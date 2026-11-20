import { emptyUnlockStats, type UnlockStats } from "@brain-rizz/shared";
import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vi as viText } from "@/i18n/locales/vi";
import { PetGrid } from "./components/PetGrid";
import { usePetUnlockStore } from "./pets.store";

/**
 * Lưới 12 bạn đồng hành ở Hồ sơ (ui-ux 6.12), dựng bằng renderToStaticMarkup (bố cục điện thoại):
 * đã mở trước, thú khoá sau với ổ khoá + điều kiện ngắn; không có số liệu → "Chưa có dữ liệu".
 */

vi.mock("@/net/unlocks-api", () => ({
  fetchUnlockStats: vi.fn(async () => ({ ok: false, reason: "not-configured" })),
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: viText } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

const stats = (patch: Partial<UnlockStats>): UnlockStats => ({ ...emptyUnlockStats(), ...patch });
const noop = () => {};
const count = (html: string, needle: string) => html.split(needle).length - 1;

/**
 * renderToStaticMarkup đọc server snapshot của zustand = trạng thái lúc tạo store, nên ghi trạng thái
 * cần thử vào cả hai.
 */
function setUnlocks(patch: Partial<ReturnType<typeof usePetUnlockStore.getState>>) {
  usePetUnlockStore.setState(patch);
  Object.assign(usePetUnlockStore.getInitialState(), usePetUnlockStore.getState());
}

describe("lưới bạn đồng hành có thú khoá", () => {
  beforeEach(() => {
    setUnlocks({
      load: "ready",
      stats: stats({ partyMatches: 12, partyWins: 1 }),
      fromServer: true,
      seen: ["pin"],
    });
  });

  it("12 thẻ: 7 đã mở (6 cũ + Pin) trước, 5 thú khoá sau có điều kiện ngắn", () => {
    const html = renderToStaticMarkup(<PetGrid value="khoi" onPick={noop} />);
    expect(count(html, "<li")).toBe(12);
    expect(count(html, 'aria-pressed="')).toBe(7);
    expect(count(html, 'aria-haspopup="dialog"')).toBe(5);
    expect(html.indexOf(">Pin<")).toBeLessThan(html.indexOf("Ộp, chưa mở khoá"));
    expect(html).toContain("Gai, chưa mở khoá: Về nhất 5 trận party.");
    expect(html).toContain("Nhất 1/5 trận");
    // Thú khoá vẽ xám, không có nút chọn.
    expect(count(html, "grayscale")).toBe(5);
  });

  it("thú đang chọn luôn hiện như đã mở (kể cả khi số liệu nói chưa)", () => {
    const html = renderToStaticMarkup(<PetGrid value="lua" onPick={noop} />);
    expect(count(html, 'aria-haspopup="dialog"')).toBe(4);
    expect(html).toContain('aria-pressed="true"');
  });

  it("chưa tải được số liệu → thú khoá ghi 'Chưa có dữ liệu'; thú đã thấy mở trên máy vẫn mở", () => {
    setUnlocks({ load: "unavailable", stats: emptyUnlockStats(), seen: ["gai"] });
    const html = renderToStaticMarkup(<PetGrid value="khoi" onPick={noop} />);
    expect(count(html, 'aria-haspopup="dialog"')).toBe(5);
    expect(count(html, "Chưa có dữ liệu")).toBe(5);
    expect(html).not.toContain("Gai, chưa mở khoá");
  });

  it("thú vừa mở chưa xem hộp chúc mừng có chip 'Mới!'", () => {
    setUnlocks({ seen: [] });
    const html = renderToStaticMarkup(<PetGrid value="khoi" onPick={noop} />);
    expect(count(html, ">Mới!<")).toBe(1);
  });
});
