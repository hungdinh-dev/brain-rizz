import { describe, expect, it } from "vitest";
import { en } from "@/i18n/locales/en";
import { vi } from "@/i18n/locales/vi";
import {
  type BotNameLabels,
  botNumbers,
  chatSender,
  joinName,
  type NameSource,
  nameParts,
} from "./bot-name";

/** Chữ thật của vi.ts / en.ts (không cần khởi tạo i18next). */
function labelsOf(locale: typeof vi): BotNameLabels {
  return {
    character: (avatar) => locale.characters[avatar].name,
    numbered: (name, n) =>
      locale.bots.numbered.replace("{{name}}", name).replace("{{n}}", String(n)),
    suffix: locale.bots.suffix,
  };
}

const VI = labelsOf(vi);
const human = (id: string, name: string): NameSource => ({ id, name, avatar: "bo" });
const bot = (id: string, avatar: NameSource["avatar"]): NameSource => ({
  id,
  name: "",
  avatar,
  isBot: true,
});

function names(players: NameSource[], labels = VI) {
  const numbers = botNumbers(players);
  return players.map((p) => joinName(nameParts(p, numbers, labels)));
}

describe("tên bot (CR-016)", () => {
  it("người thật giữ tên tự đặt, kể cả khi trùng nhân vật với bot", () => {
    expect(names([human("a", "Lan"), bot("bot-1", "bo")])).toEqual(["Lan", "Fen · máy"]);
  });

  it("bot dịch theo nhân vật + hậu tố, tách được tên và hậu tố", () => {
    const parts = nameParts(bot("bot-1", "bap"), new Map(), VI);
    expect(parts).toEqual({ name: "Bắp", suffix: "· máy" });
    expect(nameParts(human("a", "Lan"), new Map(), VI)).toEqual({ name: "Lan" });
  });

  it("bot trùng nhân vật đánh số theo thứ tự ghế, bot đầu tiên không có số", () => {
    const players = [
      human("a", "Lan"),
      bot("bot-1", "bo"),
      bot("bot-2", "mochi"),
      bot("bot-3", "bo"),
      bot("bot-4", "bo"),
    ];
    expect(names(players)).toEqual([
      "Lan",
      "Fen · máy",
      "Mochi · máy",
      "Fen 2 · máy",
      "Fen 3 · máy",
    ]);
  });

  it("bot có số tách đuôi số để giữ khi cắt tên; bot đầu và người thật không có đuôi", () => {
    const players = [human("a", "Lan"), bot("bot-1", "bo"), bot("bot-2", "bo")];
    const numbers = botNumbers(players);
    expect(nameParts(players[2] as NameSource, numbers, VI)).toEqual({
      name: "Fen 2",
      tail: " 2",
      suffix: "· máy",
    });
    expect(nameParts(players[1] as NameSource, numbers, VI).tail).toBeUndefined();
    expect(nameParts(players[0] as NameSource, numbers, VI).tail).toBeUndefined();
  });

  it("ngôn ngữ đặt số trước tên thì không tách đuôi", () => {
    const numberFirst: BotNameLabels = { ...VI, numbered: (name, n) => `${n}. ${name}` };
    const room = [bot("bot-1", "bo"), bot("bot-2", "bo")];
    expect(nameParts(bot("bot-2", "bo"), botNumbers(room), numberFirst)).toEqual({
      name: "2. Fen",
      suffix: "· máy",
    });
  });

  it("bỏ bot đầu tiên thì bot còn lại thành bot đầu (không số)", () => {
    expect(names([bot("bot-3", "bo"), bot("bot-5", "cam")])).toEqual(["Fen · máy", "Cam · máy"]);
  });

  it("tiếng Anh dùng hậu tố riêng", () => {
    expect(names([bot("bot-1", "khoi"), bot("bot-2", "khoi")], labelsOf(en))).toEqual([
      "Si · bot",
      "Si 2 · bot",
    ]);
  });

  it("tiếng Anh cũng tách đuôi số (chỗ chật cắt thành S… 2, không mất số)", () => {
    const room = [bot("bot-1", "khoi"), bot("bot-2", "khoi")];
    expect(nameParts(bot("bot-2", "khoi"), botNumbers(room), labelsOf(en))).toEqual({
      name: "Si 2",
      tail: " 2",
      suffix: "· bot",
    });
  });

  it("tin chat có cờ bot: dịch theo avatar; bot đã bị bỏ (không còn trong phòng) thì không số", () => {
    const room = [bot("bot-1", "bo"), bot("bot-2", "bo")];
    const numbers = botNumbers(room);
    const fromRoom = chatSender({ playerId: "bot-2", name: "", avatar: "bo", bot: true });
    const removed = chatSender({ playerId: "bot-7", name: "", avatar: "bo", bot: true });
    const person = chatSender({ playerId: "s1", name: "Lan", avatar: "bo" });
    expect(joinName(nameParts(fromRoom, numbers, VI))).toBe("Fen 2 · máy");
    expect(joinName(nameParts(removed, numbers, VI))).toBe("Fen · máy");
    expect(joinName(nameParts(person, numbers, VI))).toBe("Lan");
  });
});
