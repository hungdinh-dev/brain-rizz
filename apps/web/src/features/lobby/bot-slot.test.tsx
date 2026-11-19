import type { PlayerView } from "@brain-rizz/shared";
import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { vi as viText } from "@/i18n/locales/vi";
import { AddBotSlot, BotSlot } from "./components/BotSlot";
import { EmptySlot } from "./components/PlayerSlot";

/**
 * Ô bot và ô trống ở phòng chờ (CR-016, ui-ux 6.6), dựng bằng renderToStaticMarkup (không cần DOM):
 * chủ phòng có nút đổi mức / bỏ bot / thêm bot, người khác chỉ xem. Bố cục điện thoại (media query
 * phía server luôn là "không phải máy tính").
 */

vi.mock("@/net/connection", () => ({ send: vi.fn(), SERVER_ERROR_TOAST_ID: "server-error" }));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: viText } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

const BOT: PlayerView = {
  id: "bot-1",
  name: "",
  colorIndex: 1,
  avatar: "bo",
  accessories: [],
  isHost: false,
  ready: true,
  connected: true,
  difficulty: 1,
  introReady: false,
  roundScore: 0,
  roundCorrect: 0,
  totalScore: 0,
  matchPoints: 0,
  lastPoints: 0,
  categoryScores: {},
  progress: 0,
  streak: 0,
  isBot: true,
  botLevel: 1,
};

const noop = () => {};
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("ô bot ở phòng chờ (CR-016)", () => {
  it("người khác chỉ xem: tên dịch theo nhân vật, nhãn mức, không có nút", () => {
    const html = renderToStaticMarkup(
      <BotSlot player={BOT} canEdit={false} open={false} onOpenChange={noop} />,
    );
    expect(html).toContain(">Fen<");
    expect(html).toContain("· máy");
    expect(html).toContain("Vừa");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("(bạn)");
  });

  it("chủ phòng trên điện thoại: cả ô là một nút đổi mức / bỏ bot", () => {
    const html = renderToStaticMarkup(
      <BotSlot player={{ ...BOT, botLevel: 2 }} canEdit open={false} onOpenChange={noop} />,
    );
    expect(count(html, "<button")).toBe(1);
    expect(html).toContain('aria-label="Fen · máy, mức Khó. Đổi mức hoặc bỏ bot"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("chủ phòng mở ô bot: 4 ô chọn mức (mức hiện tại được chọn) và nút Bỏ bot", () => {
    const html = renderToStaticMarkup(<BotSlot player={BOT} canEdit open onOpenChange={noop} />);
    expect(html).toContain('aria-label="Đổi mức cho Fen · máy"');
    expect(count(html, 'role="radio"')).toBe(4);
    expect(count(html, 'aria-checked="true"')).toBe(1);
    expect(html).toContain("Bỏ bot");
    expect(html).toContain('aria-label="Đóng"');
  });

  it("người khác không mở được ô bot dù trạng thái mở", () => {
    const html = renderToStaticMarkup(
      <BotSlot player={BOT} canEdit={false} open onOpenChange={noop} />,
    );
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("Bỏ bot");
  });
});

describe("ô trống ở phòng chờ (CR-016)", () => {
  it("người khác thấy Mời bạn, không có Thêm bot", () => {
    const html = renderToStaticMarkup(<EmptySlot onInvite={noop} />);
    expect(html).toContain("Mời bạn");
    expect(html).not.toContain("Thêm bot");
  });

  it("chủ phòng thấy + Thêm bot", () => {
    const html = renderToStaticMarkup(
      <AddBotSlot open={false} onOpenChange={noop} onAdd={noop} pending={null} />,
    );
    expect(html).toContain("+ Thêm bot");
    expect(html).toContain('aria-label="Chỗ trống, thêm bot"');
    expect(html).not.toContain("Mời bạn");
  });

  it("chủ phòng mở ô: 4 mức ngay trong ô; đang thêm thì ô đó quay vòng, ô khác khoá", () => {
    const idle = renderToStaticMarkup(
      <AddBotSlot open onOpenChange={noop} onAdd={noop} pending={null} />,
    );
    expect(idle).toContain('aria-label="Chọn mức cho bot mới"');
    for (const level of ["Dễ", "Vừa", "Khó", "Siêu"]) {
      expect(idle).toContain(`aria-label="Thêm bot mức ${level}"`);
    }
    expect(idle).not.toContain('disabled=""');

    const busy = renderToStaticMarkup(
      <AddBotSlot open onOpenChange={noop} onAdd={noop} pending={2} />,
    );
    expect(count(busy, 'aria-busy="true"')).toBe(1);
    expect(busy).toContain("Đang thêm bot");
    expect(count(busy, 'disabled=""')).toBe(3);
  });
});
