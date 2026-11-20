import {
  BASE_CHARACTER_IDS,
  CreateOptionsSchema,
  MAX_PLAYERS,
  PET_CHARACTER_IDS,
} from "@brain-rizz/shared";
import { createInstance, type TFunction } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { en } from "@/i18n/locales/en";
import { vi } from "@/i18n/locales/vi";
import {
  BOT_COUNT_MAX,
  BOT_COUNT_MIN,
  clampBotCount,
  DEFAULT_BOT_SETUP,
  freeSeats,
  previewBotFaces,
  toBotsOption,
} from "./bot-setup";

describe("hộp thoại Chơi với máy (CR-016)", () => {
  it("mặc định 3 bot mức Vừa, chọn được 1–11 bot (phòng 12 ghế, CR-018)", () => {
    expect(DEFAULT_BOT_SETUP).toEqual({ count: 3, level: 1 });
    expect(BOT_COUNT_MIN).toBe(1);
    expect(BOT_COUNT_MAX).toBe(MAX_PLAYERS - 1);
    expect(BOT_COUNT_MAX).toBe(11);
  });

  it("số bot luôn trong khoảng cho phép", () => {
    expect(clampBotCount(0)).toBe(1);
    expect(clampBotCount(13)).toBe(11);
    expect(clampBotCount(4.4)).toBe(4);
    expect(clampBotCount(Number.NaN)).toBe(DEFAULT_BOT_SETUP.count);
  });

  it("tùy chọn gửi lên là đúng hình dạng server đọc (CreateOptionsSchema), không bị bỏ", () => {
    for (let count = BOT_COUNT_MIN; count <= BOT_COUNT_MAX; count++) {
      for (const level of [0, 1, 2, 3] as const) {
        const bots = toBotsOption(count, level);
        expect(bots).toEqual({ count, level });
        expect(CreateOptionsSchema.parse({ bots })).toEqual({ bots });
      }
    }
    expect(toBotsOption(DEFAULT_BOT_SETUP.count, DEFAULT_BOT_SETUP.level)).toEqual({
      count: 3,
      level: 1,
    });
  });

  it("dải ghế: mình + N bot + ghế trống = 12", () => {
    expect(freeSeats(3)).toBe(8);
    expect(freeSeats(11)).toBe(0);
    const me = { avatar: "bo" as const, colorIndex: 2 };
    const faces = previewBotFaces(me, 11);
    expect(faces).toHaveLength(11);
    expect(1 + faces.length + freeSeats(11)).toBe(MAX_PLAYERS);
    // Không lặp lại nhân vật / màu của mình khi còn lựa chọn khác.
    expect(faces.slice(0, BASE_CHARACTER_IDS.length - 1).every((f) => f.avatar !== me.avatar)).toBe(
      true,
    );
    // Bot chỉ là 6 nhân vật cũ, không bao giờ là thú khoá (CR-024).
    const pets: readonly string[] = PET_CHARACTER_IDS;
    expect(faces.every((f) => !pets.includes(f.avatar))).toBe(true);
    expect(new Set(faces.map((f) => f.avatar))).toEqual(
      new Set(BASE_CHARACTER_IDS.filter((id) => id !== me.avatar)),
    );
    expect(faces.every((f) => f.colorIndex !== me.colorIndex)).toBe(true);
  });
});

/**
 * Chữ tiếng Anh sửa ở QA đợt 2 (ui-ux 6.6), qua i18next thật (số nhiều `_one` / `_other`):
 * câu ghế trống của hộp thoại, aria-label chip thêm bot và chip đổi mức ở phòng chờ.
 */
describe("chữ bot qua i18next (CR-016, ui-ux 6.6)", () => {
  let tEn: TFunction;
  let tVi: TFunction;

  beforeAll(async () => {
    const make = async (lng: "en" | "vi") => {
      const i18n = createInstance();
      await i18n.init({
        lng,
        resources: { en: { common: en }, vi: { common: vi } },
        defaultNS: "common",
        interpolation: { escapeValue: false },
      });
      return i18n.t;
    };
    tEn = await make("en");
    tVi = await make("vi");
  });

  it("câu ghế trống: số nhiều theo số bot, số ghế trống đứng cuối", () => {
    const seats = (t: TFunction, count: number) =>
      t("bots.seatsFree", { count, free: freeSeats(count) });
    expect(seats(tEn, 1)).toBe("You + 1 bot · seats left for friends: 10");
    expect(seats(tEn, 10)).toBe("You + 10 bots · seats left for friends: 1");
    expect(seats(tVi, 1)).toBe("Bạn + 1 bot · còn 10 ghế cho bạn bè");
    expect(seats(tVi, 10)).toBe("Bạn + 10 bot · còn 1 ghế cho bạn bè");
  });

  it("aria-label chip thêm bot: 'Add bot: <mức>'", () => {
    const addAt = (t: TFunction, level: 0 | 1 | 2 | 3) =>
      t("bots.addAt", { level: t(`bots.level.${level}`) });
    expect([0, 1, 2, 3].map((l) => addAt(tEn, l as 0 | 1 | 2 | 3))).toEqual([
      "Add bot: Easy",
      "Add bot: Medium",
      "Add bot: Hard",
      "Add bot: Super",
    ]);
    expect(addAt(tVi, 3)).toBe("Thêm bot mức Siêu");
  });

  it("aria-label chip đổi mức (máy tính)", () => {
    expect(tEn("bots.chipLabel", { name: "Fen · bot", level: tEn("bots.level.1") })).toBe(
      "Change level for Fen · bot, now Medium",
    );
    expect(tVi("bots.chipLabel", { name: "Fen · máy", level: tVi("bots.level.1") })).toBe(
      "Đổi mức Fen · máy, đang Vừa",
    );
  });
});
