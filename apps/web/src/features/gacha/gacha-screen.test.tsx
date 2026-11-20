import { GACHA_PRICE_SINGLE, GACHA_PRICE_TEN } from "@brain-rizz/shared";
import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { enGacha } from "@/i18n/locales/gacha/en";
import { viGacha } from "@/i18n/locales/gacha/vi";
import { vi as viText } from "@/i18n/locales/vi";
import { EMPTY_WALLET, type Wallet } from "@/net/gacha-api";
import { useWallet } from "@/stores/wallet.store";
import { GachaScreen } from "./GachaScreen";

/**
 * Các trạng thái của màn Máy quay (ui-ux 6.12, bảng "Trạng thái"), bố cục điện thoại, dựng tĩnh: số dư
 * và nút quay chỉ phản ánh ví server trả về (store), không tự tính. Không gọi mạng (effect không chạy).
 */

// Barrel `@/features/home` kéo theo HomeScreen + lớp kết nối: chỉ cần hồ sơ.
vi.mock("@/features/home", () => ({
  loadProfile: () => ({
    name: "QA",
    colorIndex: 0,
    avatar: "khoi",
    difficulty: 1,
    accessories: [],
  }),
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: { ...viText, ...viGacha } } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

/** renderToStaticMarkup đọc server snapshot của zustand = trạng thái lúc tạo store: ghi vào cả hai. */
function setWallet(patch: Partial<ReturnType<typeof useWallet.getState>>) {
  useWallet.setState(patch);
  Object.assign(useWallet.getInitialState(), useWallet.getState());
}

const wallet = (balance: number, patch: Partial<Wallet> = {}): Wallet => ({
  ...EMPTY_WALLET,
  balance,
  sinceEpic: 9,
  sinceLegendary: 37,
  totalPulls: 52,
  ...patch,
});

/** `disabled` của nút quay theo aria-label "Quay 1 lượt, …" / "Quay 10 lượt, …". */
function pullButtons(html: string) {
  const state = (n: 1 | 10) => {
    const m = html.match(new RegExp(`<button[^>]*aria-label="Quay ${n} lượt, [^"]*"[^>]*>`));
    if (!m) throw new Error(`không thấy nút Quay ${n}`);
    // Thuộc tính `disabled=""` (lớp `disabled:opacity-50` cũng có chữ "disabled").
    return / disabled=""/.test(m[0]) ? "off" : "on";
  };
  return { one: state(1), ten: state(10) };
}

const render = () => renderToStaticMarkup(<GachaScreen />);

describe("màn Máy quay: trạng thái theo ví", () => {
  it("đủ phấn: hai nút bật, giá đọc từ economy, bảo hiểm thường trực có số lượt còn lại", () => {
    setWallet({ status: "ok", wallet: wallet(1_240), items: [] });
    const html = render();
    expect(pullButtons(html)).toEqual({ one: "on", ten: "on" });
    expect(html).toContain(`Quay 1 lượt, ${GACHA_PRICE_SINGLE} phấn`);
    expect(html).toContain(`Quay 10 lượt, ${GACHA_PRICE_TEN} phấn`);
    expect(html).toContain("1.240");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Sử thi trở lên: đã quay 9 trên 15 lượt, chắc chắn trong 6 lượt nữa");
    expect(html).not.toContain("Cách kiếm phấn");
    // Minh bạch (mục 2): điện thoại cũng có dòng "không mua bằng tiền thật" như máy tính.
    expect(html).toContain(viGacha.gacha.noRealMoney);
  });

  it("chỉ đủ Quay 1: Quay 10 tắt riêng", () => {
    setWallet({ status: "ok", wallet: wallet(GACHA_PRICE_SINGLE) });
    expect(pullButtons(render())).toEqual({ one: "on", ten: "off" });
  });

  it("thiếu phấn: hai nút tắt, thẻ Cách kiếm phấn thay Bảo hiểm (điện thoại), nói rõ không mua bằng tiền", () => {
    setWallet({ status: "ok", wallet: wallet(30) });
    const html = render();
    expect(pullButtons(html)).toEqual({ one: "off", ten: "off" });
    expect(html).toContain(`Cần thêm ${GACHA_PRICE_SINGLE - 30} phấn để quay 1 lượt.`);
    expect(html).toContain("Không mua phấn bằng tiền.");
    expect(html).not.toContain("Bảo hiểm");
    // Không chữ gây áp lực (mục 2): không đếm giờ, không "chỉ còn", không "nhanh tay".
    expect(html).not.toMatch(/chỉ còn|sắp hết|nhanh tay|đếm ngược/i);
  });

  it("chưa có phiên = ví trống (0 phấn), vẫn hiện như thiếu phấn, không phải lỗi", () => {
    setWallet({ status: "no-session", wallet: EMPTY_WALLET });
    const html = render();
    expect(pullButtons(html)).toEqual({ one: "off", ten: "off" });
    expect(html).toContain("Cách kiếm phấn");
    expect(html).not.toContain("Chưa kết nối máy chủ dữ liệu");
  });

  it("chưa kết nối máy chủ dữ liệu (DB chưa có máy quay): số dư '—', nút tắt, ẩn bảo hiểm, có Thử lại", () => {
    setWallet({ status: "offline", wallet: null, items: null });
    const html = render();
    expect(pullButtons(html)).toEqual({ one: "off", ten: "off" });
    expect(html).toContain("Chưa kết nối máy chủ dữ liệu");
    expect(html).toContain("Thử lại");
    expect(html).not.toContain("Bảo hiểm");
  });

  it("đang tải: nút tắt, chưa hiện số dư", () => {
    setWallet({ status: "loading", wallet: null, items: null });
    const html = render();
    expect(pullButtons(html)).toEqual({ one: "off", ten: "off" });
    expect(html).not.toContain("Chưa kết nối máy chủ dữ liệu");
  });
});

describe("câu chữ máy quay", () => {
  it("lỗi quay không khẳng định phấn chưa bị trừ (máy chủ có thể đã quay xong), chỉ Thử lại để xem", () => {
    for (const text of [viGacha.gacha.pullError, enGacha.gacha.pullError]) {
      expect(text).not.toMatch(/chưa bị trừ|wasn't spent|not spent/i);
    }
    expect(viGacha.gacha.pullError).toContain("không bị trừ thêm");
  });

  it("trùng món: nói rõ được đổi lại phấn", () => {
    expect(viGacha.gacha.rates.dupBody).toMatch(/^Trùng món được đổi lại phấn:/);
    expect(enGacha.gacha.rates.dupBody).toMatch(/^Duplicates are traded back for chalk:/);
  });
});
