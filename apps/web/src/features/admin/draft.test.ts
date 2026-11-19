import { DEFAULT_SCORING, GAME_IDS, GAMES, gameMultiplier } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  baseMultiplier,
  checkDraft,
  diffDraft,
  draftFromConfig,
  formatDraftNumber,
  isToggleLocked,
  parseDraftNumber,
  resetGame,
  restoreDefaultFields,
  setCell,
  setField,
  setGameEnabled,
} from "./draft";

/** Bản nháp trang quản trị (CR-019): kiểm bằng ScoringConfigSchema, giữ ≥ 2 game, đếm thay đổi. */

const APPLIED = { scoring: DEFAULT_SCORING, disabledGames: [] as string[] };
const fresh = (decimal: "," | "." = ",") => draftFromConfig(DEFAULT_SCORING, [], decimal);

describe("số trong ô nhập", () => {
  it("định dạng theo dấu thập phân của ngôn ngữ, không nhóm hàng nghìn", () => {
    expect(formatDraftNumber(0.1, ",")).toBe("0,1");
    expect(formatDraftNumber(1.25, ".")).toBe("1.25");
    expect(formatDraftNumber(8000, ",")).toBe("8000");
    expect(formatDraftNumber(0.1 + 0.2, ".")).toBe("0.3");
  });

  it("đọc cả dấu phẩy lẫn dấu chấm; ô số nguyên nhận nhóm hàng nghìn", () => {
    expect(parseDraftNumber("1,5", false)).toBe(1.5);
    expect(parseDraftNumber(" 1.25 ", false)).toBe(1.25);
    expect(parseDraftNumber("1.500", true)).toBe(1500);
    expect(parseDraftNumber("10,000", true)).toBe(10000);
    expect(parseDraftNumber("1.5", true)).toBe(1.5);
    expect(parseDraftNumber("", true)).toBeNaN();
    expect(parseDraftNumber("abc", false)).toBeNaN();
    expect(parseDraftNumber("1,2,3", false)).toBeNaN();
  });
});

describe("kiểm bản nháp", () => {
  it("bản nháp từ mặc định hợp lệ và dựng lại đúng DEFAULT_SCORING", () => {
    for (const decimal of [",", "."] as const) {
      const check = checkDraft(fresh(decimal));
      expect(check.invalidCount).toBe(0);
      expect(check.config).toEqual(DEFAULT_SCORING);
      expect(diffDraft(APPLIED, fresh(decimal), check).count).toBe(0);
    }
  });

  it("ô sai: ngoài khoảng, không phải số nguyên, không phải số", () => {
    let draft = setField(fresh(), "basePoints", "5");
    draft = setField(draft, "streakThreshold", "2,5");
    draft = setField(draft, "maxSpeedBonus", "nhiều");
    draft = setField(draft, "difficultyMultiplier.0", "0");
    const check = checkDraft(draft);
    expect(check.config).toBeNull();
    expect(check.fieldErrors.basePoints).toEqual({ kind: "range", min: 10, max: 1000 });
    expect(check.fieldErrors.streakThreshold).toEqual({ kind: "integer" });
    expect(check.fieldErrors.maxSpeedBonus).toEqual({ kind: "number" });
    expect(check.fieldErrors["difficultyMultiplier.0"]).toEqual({ kind: "multiplier" });
    expect(check.invalidCount).toBe(4);
    // Xem thử: ô sai về mặc định của trường đó.
    expect(check.preview.basePoints).toBe(DEFAULT_SCORING.basePoints);
  });

  it("mốc Chậm phải sau mốc Nhanh (báo ở ô Chậm)", () => {
    const draft = setField(setField(fresh(), "fastAnswerMs", "9000"), "slowAnswerMs", "8000");
    const check = checkDraft(draft);
    expect(check.fieldErrors.slowAnswerMs).toEqual({ kind: "slow", fast: 9000 });
    expect(check.fieldErrors.fastAnswerMs).toBeUndefined();
    expect(check.invalidCount).toBe(1);
  });

  it("đếm thay đổi: tắt game, đổi ô, ghi đè hệ số", () => {
    let draft = setField(fresh(), "maxSpeedBonus", "60");
    draft = setGameEnabled(draft, "balance", false)!;
    draft = setGameEnabled(draft, "fold-box", false)!;
    draft = setCell(draft, "fold-box", 2, "1,4");
    const check = checkDraft(draft);
    expect(check.config).not.toBeNull();
    const { changes, count } = diffDraft(APPLIED, draft, check);
    expect(count).toBe(4);
    expect(changes).toContainEqual({ kind: "disable", ids: ["balance", "fold-box"] });
    expect(changes).toContainEqual({ kind: "field", key: "maxSpeedBonus", from: 50, to: 60 });
    const game = changes.find((c) => c.kind === "game");
    expect(game).toMatchObject({ kind: "game", id: "fold-box", from: null });
  });
});

describe("hệ số theo game", () => {
  it("ghi đè một ô: các ô khác giữ hệ số game khai báo", () => {
    const draft = setCell(fresh(), "fold-box", 2, "1,4");
    const quad = checkDraft(draft).config?.gameMultipliers["fold-box"];
    const declared = [0, 1, 2, 3].map((d) => gameMultiplier(GAMES["fold-box"], d as 0 | 1 | 2 | 3));
    expect(quad).toEqual([declared[0], declared[1], 1.4, declared[3]]);
  });

  it("gõ lại đúng hệ số mặc định → không còn là ghi đè; Về mặc định bỏ hết", () => {
    const base = baseMultiplier("balance", 1, DEFAULT_SCORING.difficultyMultiplier);
    let draft = setCell(fresh("."), "balance", 1, String(base));
    expect(checkDraft(draft).config?.gameMultipliers).toEqual({});
    draft = setCell(draft, "balance", 3, "4");
    expect(Object.keys(checkDraft(draft).config?.gameMultipliers ?? {})).toEqual(["balance"]);
    draft = resetGame(draft, "balance");
    expect(checkDraft(draft).config?.gameMultipliers).toEqual({});
  });

  it("ô hệ số sai được báo theo game và độ khó", () => {
    const draft = setCell(fresh(), "balance", 0, "9");
    const check = checkDraft(draft);
    expect(check.config).toBeNull();
    expect(check.cellErrors.balance).toEqual([true, false, false, false]);
    expect(check.invalidCount).toBe(1);
  });

  it("đọc lại ghi đè từ cấu hình đã lưu, bộ số trùng mặc định coi như không ghi đè", () => {
    const declared = [0, 1, 2, 3].map((d) =>
      baseMultiplier("balance", d as 0, [0.8, 1, 1.25, 1.5]),
    );
    const scoring = {
      ...DEFAULT_SCORING,
      gameMultipliers: {
        "fold-box": [0.85, 1, 1.4, 1.7] as [number, number, number, number],
        balance: declared as [number, number, number, number],
      },
    };
    const draft = draftFromConfig(scoring, ["balance"], ".");
    expect(draft.overrides.balance).toBeUndefined();
    expect(draft.overrides["fold-box"]?.filter((c) => c !== null)).toEqual(["1.4", "1.7"]);
    const check = checkDraft(draft);
    expect(diffDraft({ scoring, disabledGames: ["balance"] }, draft, check).count).toBe(0);
  });
});

describe("bật/tắt game", () => {
  it("không cho tắt khi chỉ còn 2 game bật; 2 công tắc đó bị khoá", () => {
    const [a, b, ...rest] = GAME_IDS;
    let draft = draftFromConfig(DEFAULT_SCORING, rest, ",");
    expect(isToggleLocked(draft, a)).toBe(true);
    expect(isToggleLocked(draft, rest[0]!)).toBe(false);
    expect(setGameEnabled(draft, b!, false)).toBeNull();
    draft = setGameEnabled(draft, rest[0]!, true)!;
    expect(isToggleLocked(draft, a)).toBe(false);
    expect(setGameEnabled(draft, a, false)?.disabled).not.toContain(rest[0]);
  });
});

it("Khôi phục mặc định chỉ đổi các ô, giữ game tắt và ghi đè", () => {
  let draft = setField(fresh(), "basePoints", "300");
  draft = setGameEnabled(draft, "balance", false)!;
  draft = setCell(draft, "fold-box", 2, "1,4");
  const restored = restoreDefaultFields(draft, ",");
  expect(restored.fields.basePoints).toBe("100");
  expect(restored.disabled).toEqual(["balance"]);
  expect(restored.overrides["fold-box"]).toEqual(draft.overrides["fold-box"]);
});
