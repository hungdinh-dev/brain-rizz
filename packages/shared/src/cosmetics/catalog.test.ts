import { describe, expect, it } from "vitest";
import {
  COSMETIC_IDS,
  COSMETIC_ITEMS,
  COSMETIC_SLOTS,
  cosmeticsByRarity,
  getCosmetic,
  isCosmeticId,
  MAX_ACCESSORIES,
  MAX_COSMETIC_ID_LENGTH,
  RARITIES,
  sanitizeLoadout,
} from "./catalog";

/** Bảng mục 3.1 của kế hoạch (chỗ → độ hiếm → id), chép tay để test bắt mọi lệch. */
const PLAN_TABLE = {
  head: {
    common: ["beanie", "bow", "cap"],
    rare: ["flower-crown", "witch-hat", "grad-cap", "headphones"],
    epic: ["crown", "cowboy"],
    legendary: ["halo"],
  },
  face: {
    common: ["round-glasses", "sunglasses", "bandage"],
    rare: ["heart-glasses", "hero-mask"],
    epic: ["monocle"],
    legendary: ["star-glasses"],
  },
  neck: {
    common: ["scarf", "bowtie", "bell"],
    rare: ["cape", "lei"],
    epic: ["pearls"],
    legendary: ["royal-cape"],
  },
} as const;

describe("danh mục phụ kiện", () => {
  it("đúng 24 món của bảng mục 3.1, id không trùng", () => {
    const expected = COSMETIC_SLOTS.flatMap((slot) =>
      RARITIES.flatMap((rarity) => PLAN_TABLE[slot][rarity].map((id) => ({ id, slot, rarity }))),
    );
    expect(COSMETIC_ITEMS).toEqual(expected);
    expect(COSMETIC_ITEMS).toHaveLength(24);
    expect(new Set(COSMETIC_IDS).size).toBe(24);
  });

  it("số món theo độ hiếm 9 / 8 / 4 / 3", () => {
    expect(RARITIES.map((r) => cosmeticsByRarity(r).length)).toEqual([9, 8, 4, 3]);
  });

  it("id ngắn, chữ thường và gạch nối (khớp kiểm tra của giao thức và SQL)", () => {
    for (const id of COSMETIC_IDS) {
      expect(id.length).toBeLessThanOrEqual(MAX_COSMETIC_ID_LENGTH);
      expect(id).toMatch(/^[a-z][a-z-]*[a-z]$/);
    }
    expect(MAX_ACCESSORIES).toBe(3);
  });

  it("isCosmeticId / getCosmetic chỉ nhận id trong danh mục", () => {
    for (const item of COSMETIC_ITEMS) {
      expect(isCosmeticId(item.id)).toBe(true);
      expect(getCosmetic(item.id)).toBe(item);
    }
    for (const v of [
      "",
      "Halo",
      "halo ",
      "toString",
      "__proto__",
      "constructor",
      1,
      null,
      undefined,
      {},
    ]) {
      expect(isCosmeticId(v)).toBe(false);
    }
    expect(getCosmetic("constructor")).toBeUndefined();
  });
});

describe("sanitizeLoadout", () => {
  it("không phải mảng → rỗng, không ném", () => {
    for (const v of [undefined, null, "halo", 3, { 0: "halo" }, new Set(["halo"])]) {
      expect(sanitizeLoadout(v)).toEqual([]);
    }
  });

  it("bỏ id lạ và phần tử không phải chuỗi", () => {
    expect(sanitizeLoadout(["nope", 7, null, "cap", { id: "halo" }])).toEqual(["cap"]);
  });

  it("mỗi chỗ một món (giữ món gặp đầu tiên), xếp theo đầu → mặt → cổ", () => {
    expect(sanitizeLoadout(["scarf", "monocle", "halo", "crown", "sunglasses", "cape"])).toEqual([
      "halo",
      "monocle",
      "scarf",
    ]);
  });

  it("bỏ trùng, tối đa MAX_ACCESSORIES món", () => {
    expect(sanitizeLoadout(["cap", "cap", "cap"])).toEqual(["cap"]);
    const all = sanitizeLoadout([...COSMETIC_IDS]);
    expect(all).toHaveLength(MAX_ACCESSORIES);
    expect(all).toEqual(["beanie", "round-glasses", "scarf"]);
  });

  it("lọc theo món đã sở hữu (Set hoặc mảng); món chưa có nhường chỗ cho món sau cùng chỗ", () => {
    const loadout = ["crown", "cap", "monocle", "bell"];
    expect(sanitizeLoadout(loadout, new Set(["cap", "bell"]))).toEqual(["cap", "bell"]);
    expect(sanitizeLoadout(loadout, ["crown", "monocle"])).toEqual(["crown", "monocle"]);
    expect(sanitizeLoadout(loadout, [])).toEqual([]);
  });

  it("idempotent: lọc lại kết quả không đổi", () => {
    const once = sanitizeLoadout(["lei", "hero-mask", "witch-hat", "bowtie"]);
    expect(sanitizeLoadout(once)).toEqual(once);
  });
});
