import type { PlayerView } from "@brain-rizz/shared";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DifficultyChip } from "@/components/common/MatchChips";
import { vi as viText } from "@/i18n/locales/vi";
import { Scoreboard } from "./components/Scoreboard";
import { rankByRoundScore } from "./standings";

/**
 * Bảng điểm khi chơi (CR-016, ui-ux 6.6): chữ bị giấu khỏi mắt để nhường chỗ cho tên vẫn phải còn
 * cho trình đọc màn hình — "(bạn)" ở hàng của mình, tên mức độ khó (kèm `title` cho chuột).
 * Dựng tĩnh bằng react-dom/server (không cần DOM); bố cục co giãn đã đo trên trình duyệt.
 */

const { PLAYERS } = vi.hoisted(() => {
  const base = {
    ready: true,
    introReady: true,
    connected: true,
    isHost: false,
    matchPoints: 0,
    lastPoints: 0,
    totalScore: 0,
    categoryScores: {},
    roundCorrect: 0,
    progress: 3,
    botLevel: 0,
  };
  return {
    PLAYERS: [
      {
        ...base,
        id: "me",
        name: "Nguyễn Thị Hương",
        colorIndex: 0,
        avatar: "khoi",
        difficulty: 1,
        isHost: true,
        roundScore: 1234,
        streak: 0,
        isBot: false,
      },
      {
        ...base,
        id: "bot-1",
        name: "",
        colorIndex: 1,
        avatar: "bo",
        difficulty: 3,
        roundScore: 99999,
        streak: 5,
        isBot: true,
        botLevel: 3,
      },
      {
        ...base,
        id: "bot-2",
        name: "",
        colorIndex: 2,
        avatar: "bo",
        difficulty: 3,
        roundScore: 500,
        streak: 0,
        isBot: true,
        botLevel: 3,
      },
    ] as unknown as PlayerView[],
  };
});

// Tên bot đánh số theo ghế trong phòng đang mở: giả lập store (dựng tĩnh thì zustand trả state đầu).
vi.mock("@/stores/game.store", () => {
  const state = { party: { players: Object.fromEntries(PLAYERS.map((p) => [p.id, p])) } };
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

/** Tách HTML theo từng hàng `<li>` của bảng điểm, giữ thứ tự xếp hạng. */
function renderRows(): string[] {
  const html = renderToStaticMarkup(
    createElement(Scoreboard, { standings: rankByRoundScore(PLAYERS), meId: "me", round: 2 }),
  );
  return html.split("<li").slice(1);
}

describe("Scoreboard (CR-016)", () => {
  it('"(bạn)" chỉ ở hàng của mình và chỉ cho trình đọc màn hình', () => {
    const rows = renderRows();
    const mine = rows.filter((r) => r.includes("Nguyễn Thị Hương"));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toContain('<span class="sr-only"> (bạn)</span>');
    for (const r of rows.filter((row) => !row.includes("Nguyễn Thị Hương"))) {
      expect(r).not.toContain("(bạn)");
    }
  });

  it("nhãn độ khó luôn có chữ trong DOM và title đúng tên mức", () => {
    const rows = renderRows();
    // Xếp theo điểm: bot 99.999 (Siêu khó), mình 1.234 (Thường), bot 500 (Siêu khó).
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/title="Siêu khó"[^>]*>Siêu khó<\/span>/);
    expect(rows[1]).toMatch(/title="Thường"[^>]*>Thường<\/span>/);
    expect(rows[2]).toMatch(/title="Siêu khó"[^>]*>Siêu khó<\/span>/);
  });

  it("tên đầy đủ của bot và người vẫn có trong title, điểm định dạng theo ngôn ngữ", () => {
    const rows = renderRows();
    expect(rows[0]).toContain('title="Fen · máy"');
    expect(rows[0]).toContain("99.999");
    expect(rows[1]).toContain('title="Nguyễn Thị Hương"');
    expect(rows[2]).toContain('title="Fen 2 · máy"');
  });
});

describe("DifficultyChip", () => {
  it("không truyền title thì không thêm thuộc tính title (các màn khác giữ nguyên)", () => {
    const html = renderToStaticMarkup(createElement(DifficultyChip, { difficulty: 2 }));
    expect(html).not.toContain("title=");
    expect(html).toContain(">Khó</span>");
  });

  it("truyền title thì gắn vào nhãn", () => {
    const html = renderToStaticMarkup(
      createElement(DifficultyChip, { difficulty: 0, title: "Mầm" }),
    );
    expect(html).toContain('title="Mầm"');
  });
});
