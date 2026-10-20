import { SHADOW_ITEMS, SHADOW_VARIANTS, shadowDiff, shadowParts } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { diffRing, FRAME, ITEM_ART, placeParts } from "./art";

describe("hình đồ vật của Bóng của ai", () => {
  it("mọi khoá phần hình của mọi biến thể đều đã có hình vẽ", () => {
    for (const item of SHADOW_ITEMS) {
      for (let variant = 0; variant < SHADOW_VARIANTS; variant++) {
        expect(() => placeParts(item, shadowParts(item, variant))).not.toThrow();
      }
    }
  });

  it("mỗi mồi cùng vật có vòng khoanh chi tiết khác, nằm trong khung vẽ", () => {
    for (const item of SHADOW_ITEMS) {
      for (let variant = 1; variant < SHADOW_VARIANTS; variant++) {
        const { missing, extra } = shadowDiff(item, variant);
        const ring = diffRing(item, [...missing, ...extra]);
        expect(ring).not.toBeNull();
        const [cx, cy, r] = ring ?? [0, 0, 0];
        expect(r).toBeGreaterThan(0);
        expect(Math.abs(cx)).toBeLessThan(FRAME / 2);
        expect(Math.abs(cy)).toBeLessThan(FRAME / 2);
      }
    }
  });

  it("không có hình vẽ thừa (phần nào cũng được bộ vật trong shared dùng)", () => {
    for (const item of SHADOW_ITEMS) {
      const used = new Set<string>();
      for (let variant = 0; variant < SHADOW_VARIANTS; variant++) {
        for (const key of shadowParts(item, variant)) used.add(key.slice(0, key.lastIndexOf("@")));
      }
      expect(Object.keys(ITEM_ART[item].parts).sort()).toEqual([...used].sort());
    }
  });
});
