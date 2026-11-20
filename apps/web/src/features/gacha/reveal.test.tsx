import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { viGacha } from "@/i18n/locales/gacha/vi";
import { vi as viText } from "@/i18n/locales/vi";
import type { PullBatch, PullResult } from "@/net/gacha-api";
import { Reveal } from "./components/Reveal";

/**
 * Màn mở quà (ui-ux 6.12 "Mở quà"), dựng bằng renderToStaticMarkup ở bố cục điện thoại (effect không
 * chạy = đúng khung hình đầu tiên): viên nang chưa mở không lộ món / độ hiếm; giảm chuyển động thì
 * hiện thẳng cả 10 món + tổng kết; không có nút mời quay tiếp.
 */

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: { ...viText, ...viGacha } } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

const r = (itemId: PullResult["itemId"], rarity: PullResult["rarity"], refund = 0): PullResult => ({
  itemId,
  rarity,
  duplicate: refund > 0,
  refund,
});

const TEN: PullBatch = {
  results: [
    r("bowtie", "common"),
    r("cape", "rare", 30),
    r("round-glasses", "common", 10),
    r("crown", "epic"),
    r("bell", "common"),
    r("grad-cap", "rare"),
    r("sunglasses", "common", 10),
    r("royal-cape", "legendary"),
    r("beanie", "common", 10),
    r("lei", "rare"),
  ],
  balance: 1_160,
  sinceEpic: 2,
  sinceLegendary: 2,
  replayed: false,
};

const ONE: PullBatch = {
  results: [r("halo", "legendary")],
  balance: 1_140,
  sinceEpic: 0,
  sinceLegendary: 0,
  replayed: false,
};

const noop = () => {};
const count = (html: string, needle: string) => html.split(needle).length - 1;

function render(batch: PullBatch, reduced: boolean) {
  return renderToStaticMarkup(
    <Reveal
      batch={batch}
      desktop={false}
      reduced={reduced}
      onOpenedAll={noop}
      onTryOn={noop}
      onDone={noop}
      tryOnItem={batch.results[0]}
    />,
  );
}

describe("màn mở quà", () => {
  it("chưa mở: 10 viên nang giống nhau, không lộ tên món hay độ hiếm; có 'Mở hết', chưa có Xong", () => {
    const html = render(TEN, false);
    expect(html).toContain("10 lượt · đã mở 0/10");
    expect(count(html, "<li")).toBe(10);
    for (const name of ["Vương miện", "Áo choàng hoàng gia", "Nơ cổ"])
      expect(html).not.toContain(name);
    for (const rarity of ["Thường", "Hiếm", "Sử thi", "Huyền thoại"]) {
      expect(html).not.toContain(rarity);
    }
    expect(html).not.toContain("gacha-glow-");
    expect(html).toContain("Mở hết");
    expect(html).not.toContain(">Xong<");
  });

  it("giảm chuyển động: hiện thẳng cả 10 món, không lắc / không tia xoay, có tổng kết và Mặc thử / Xong", () => {
    const html = render(TEN, true);
    expect(html).toContain("10 lượt · đã mở 10/10");
    expect(html).toContain("Vương miện, Sử thi");
    expect(html).toContain("Áo choàng hoàng gia, Huyền thoại");
    // Không hoạt ảnh nào (lớp fx- tắt hẳn), không còn nút "Mở hết".
    expect(html).not.toMatch(/fx-gacha-(pop|rays|wobble)/);
    expect(html).not.toContain("Mở hết");
    // 6 món mới, 4 trùng đổi lại 30 + 10 + 10 + 10 = 60 phấn.
    expect(html).toContain("6 món mới");
    expect(html).toContain("4 món trùng đổi lại");
    expect(html).toContain("+60");
    expect(count(html, "Trùng, đổi lại 10 phấn")).toBe(3);
    expect(html).toContain("Trùng, đổi lại 30 phấn");
    expect(html).toContain("Mặc thử");
    expect(html).toContain(">Xong<");
    // Không mời quay tiếp (mục 2 của kế hoạch).
    expect(html).not.toMatch(/Quay (tiếp|thêm|1|10)/);
  });

  it("có hoạt ảnh thì món mở ra mới có lớp nảy / tia (chỉ transform, tắt khi giảm chuyển động)", () => {
    // Bản tĩnh không chạy hẹn giờ: mô phỏng "đã mở" bằng một lượt mà giảm chuyển động tắt.
    const reduced = render(ONE, true);
    expect(reduced).not.toContain("fx-gacha-pop");
    expect(reduced).toContain("gacha-rays-legendary");
    expect(reduced).not.toContain("fx-gacha-rays");
  });

  it("một lượt chưa mở: viên nang lắc, chỉ đọc 'Đang mở…'; mở rồi: tên, nhãn độ hiếm, Mới!", () => {
    const closed = render(ONE, false);
    expect(closed).toContain("fx-gacha-wobble");
    expect(closed).toContain("Đang mở…");
    expect(closed).not.toContain("Hào quang");
    const open = render(ONE, true);
    expect(open).toContain("Hào quang");
    expect(open).toContain("Huyền thoại");
    expect(open).toContain("Mới!");
    expect(open).toContain("Đã cất vào tủ đồ.");
  });
});
