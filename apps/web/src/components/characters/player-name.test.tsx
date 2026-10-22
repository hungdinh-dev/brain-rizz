import i18next from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { vi as viText } from "@/i18n/locales/vi";
import type { NameSource } from "./bot-name";
import { PlayerName } from "./PlayerName";

/**
 * Tên người chơi ở chỗ chật (CR-016): `compact` ẩn hậu tố "· máy" khỏi mắt nhưng trình đọc màn
 * hình và `title` vẫn có đủ "Fen 2 · máy"; số của bot trùng nhân vật đứng riêng để không bị cắt.
 * Dựng tĩnh bằng react-dom/server (không cần DOM).
 */

const { HUMAN, FIRST, SECOND } = vi.hoisted(() => ({
  HUMAN: { id: "a", name: "Lan", avatar: "bo" } as NameSource,
  FIRST: { id: "bot-1", name: "", avatar: "bo", isBot: true } as NameSource,
  SECOND: { id: "bot-2", name: "", avatar: "bo", isBot: true } as NameSource,
}));

// Phòng đang mở: người chơi theo thứ tự ghế (đủ để đánh số bot). Dựng tĩnh thì zustand luôn trả
// state ban đầu, nên giả lập store thay vì setState.
vi.mock("@/stores/game.store", () => {
  const players = Object.fromEntries([HUMAN, FIRST, SECOND].map((p) => [p.id, p]));
  const state = { party: { players } };
  return { useGame: (select: (s: typeof state) => unknown) => select(state) };
});

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: "vi",
    resources: { vi: { common: viText } },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
});

const render = (player: NameSource, compact?: boolean) =>
  renderToStaticMarkup(<PlayerName player={player} compact={compact} className="truncate" />);

describe("PlayerName (CR-016)", () => {
  it("mặc định: tên và hậu tố là hai phần anh em, hậu tố hiện rõ", () => {
    const html = render(SECOND);
    expect(html).toContain(">Fen 2</span>");
    expect(html).toMatch(/<span class="[^"]*shrink-0[^"]*">· máy<\/span>/);
    expect(html).not.toContain("sr-only");
  });

  it("compact: hậu tố chỉ cho trình đọc màn hình, title đọc đủ tên", () => {
    const html = render(SECOND, true);
    expect(html).toContain('title="Fen 2 · máy"');
    expect(html).toContain('<span class="sr-only"> · máy</span>');
    // Phần chữ cắt được, số đứng riêng không co.
    expect(html).toContain('<span class="truncate">Fen</span>');
    expect(html).toMatch(/<span class="[^"]*shrink-0[^"]*"> 2<\/span>/);
  });

  it("compact: bot đầu không có số, người thật không có hậu tố", () => {
    const bot = render(FIRST, true);
    expect(bot).toContain('title="Fen · máy"');
    expect(bot).toContain('<span class="truncate">Fen</span><span class="sr-only"> · máy</span>');
    const human = render(HUMAN, true);
    expect(human).toContain('title="Lan"');
    expect(human).not.toContain("sr-only");
  });
});
