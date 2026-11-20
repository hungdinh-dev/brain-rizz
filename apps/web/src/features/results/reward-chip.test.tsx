import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi as viText } from "@/i18n/locales/vi";
import { useGame } from "@/stores/game.store";
import { RewardChip } from "./components/RewardChip";

/**
 * "+N phấn" sau trận party (CR-023, ui-ux 6.12), dựng tĩnh ở khung hình đầu (`reserve`: giữ chỗ trước
 * khi nảy vào). Tin `reward` chỉ tới người có phiên trong trận đã ghi; `0` = chạm trần ngày → "+0" kèm
 * một dòng giải thích, không ẩn hẳn. Không có tin (khách không phiên) → không hiện gì.
 */

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: viText } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

/** renderToStaticMarkup đọc server snapshot của zustand = trạng thái lúc tạo store: ghi vào cả hai. */
function setReward(reward: number | null) {
  useGame.setState({ reward });
  Object.assign(useGame.getInitialState(), { reward });
}

afterAll(() => setReward(null));

const render = (note = false) =>
  renderToStaticMarkup(<RewardChip shown={false} reserve note={note} />);

describe("RewardChip", () => {
  it("không có tin thưởng (khách không phiên / chưa kết nối) → không hiện gì", () => {
    setReward(null);
    expect(render(true)).toBe("");
  });

  it("có phấn → chip +N, dòng 'Đã cộng vào ví' khi bật note", () => {
    setReward(45);
    const html = render(true);
    expect(html).toContain("+45 phấn");
    expect(html).toContain(viText.rewards.wallet);
    expect(html).not.toContain(viText.rewards.capped);
  });

  it("chạm trần ngày (0) → chip +0 tông thẻ kèm dòng giải thích, không nói đã cộng vào ví", () => {
    setReward(0);
    for (const note of [false, true]) {
      const html = render(note);
      expect(html).toContain("+0 phấn");
      expect(html).toContain(viText.rewards.capped);
      expect(html).not.toContain(viText.rewards.wallet);
    }
  });
});
