/**
 * Bộ đồ vật của "Bóng của ai" (đặc tả: docs/04-minigames/shadow-match.md, mục Bộ vật).
 *
 * Mỗi vật là một danh sách PHẦN HÌNH. Mỗi phần là một khoá `"<tên>@<phía>"`:
 * - `@L` / `@R`: phần nằm (hoặc quay mặt) về bên trái / phải. Hai khoá cùng tên khác phía là ảnh
 *   gương của nhau qua trục dọc giữa khung vẽ của vật.
 * - `@C`: phần tự đối xứng qua trục dọc (vd. thân ấm, nắp ấm).
 *
 * Lật gương cả vật = đổi mọi `@L` ↔ `@R`. Xoay không đổi danh sách phần. Vì vậy hai bóng của cùng
 * một vật trông giống hệt nhau (sau khi xoay/lật) khi và chỉ khi danh sách phần bằng nhau, hoặc
 * bằng nhau sau khi đổi phía. Test dựa vào điều này để chứng minh mỗi câu có đúng một đáp án.
 *
 * Biến thể 0 là hình gốc. Biến thể 1–6 là mồi: 1–2 khác chi tiết LỚN, 3–6 khác chi tiết NHỎ.
 * Không có chữ giao diện ở đây; FE vẽ từng khoá phần hình (apps/web/src/games/shadow-match/).
 */

export const SHADOW_ITEMS = [
  "teapot",
  "fish",
  "cat",
  "cactus",
  "umbrella",
  "chicken",
  "shoe",
  "lamp",
] as const;
export type ShadowItem = (typeof SHADOW_ITEMS)[number];

/** Khoá phần hình, dạng `"<tên>@L" | "<tên>@R" | "<tên>@C"`. */
export type ShadowPart = `${string}@${"L" | "R" | "C"}`;

/** Cỡ chi tiết khác biệt của một mồi so với hình gốc. */
export type ShadowDetailSize = "big" | "small";

export interface ShadowDecoyDef {
  size: ShadowDetailSize;
  /** Phần của hình gốc bị bỏ đi. */
  remove: readonly ShadowPart[];
  /** Phần thêm vào (không có trong hình gốc). */
  add: readonly ShadowPart[];
}

export interface ShadowItemDef {
  /** Biến thể 0. */
  base: readonly ShadowPart[];
  /** Biến thể 1…6, theo thứ tự: 2 mồi lớn rồi 4 mồi nhỏ. */
  decoys: readonly ShadowDecoyDef[];
}

/** Số mồi lớn và nhỏ của MỖI vật (test kiểm). */
export const SHADOW_BIG_DECOYS = 2;
export const SHADOW_SMALL_DECOYS = 4;
/** Số biến thể mỗi vật, kể cả hình gốc. */
export const SHADOW_VARIANTS = 1 + SHADOW_BIG_DECOYS + SHADOW_SMALL_DECOYS;

const big = (remove: readonly ShadowPart[], add: readonly ShadowPart[] = []): ShadowDecoyDef => ({
  size: "big",
  remove,
  add,
});
const small = (remove: readonly ShadowPart[], add: readonly ShadowPart[] = []): ShadowDecoyDef => ({
  size: "small",
  remove,
  add,
});

export const SHADOW_ITEM_DEFS: Readonly<Record<ShadowItem, ShadowItemDef>> = {
  // Ấm trà: vòi bên phải, quai bên trái.
  teapot: {
    base: ["body@C", "lid@C", "knob@C", "foot@C", "spout@R", "handle@L"],
    decoys: [
      big(["spout@R"]), // mất vòi
      big(["handle@L"]), // mất quai
      small(["knob@C"]), // mất núm nắp
      small(["spout@R"], ["spout-short@R"]), // vòi ngắn
      small(["foot@C"]), // mất đế
      small(["lid@C"], ["lid-tall@C"]), // nắp cao
    ],
  },
  // Cá quay đầu sang phải, đuôi chẻ bên trái.
  fish: {
    base: ["body@R", "tail@L", "fin-top@R", "fin-belly@R", "fin-anal@R"],
    decoys: [
      big(["tail@L"]), // mất đuôi
      big(["fin-top@R"]), // mất vây lưng
      small(["fin-belly@R"]), // mất vây bụng
      small(["fin-anal@R"]), // mất vây hậu môn
      small(["tail@L"], ["tail-round@L"]), // đuôi tròn thay đuôi chẻ
      small(["fin-top@R"], ["fin-top-small@R"]), // vây lưng nhỏ
    ],
  },
  // Mèo ngồi nhìn thẳng, đuôi cong lên bên phải.
  cat: {
    base: ["body@C", "head@C", "ear@L", "ear@R", "tail@R", "whiskers@C"],
    decoys: [
      big(["tail@R"]), // mất đuôi
      big(["ear@L", "ear@R"]), // mất cả hai tai
      small(["whiskers@C"]), // mất ria
      small(["ear@L"]), // mất tai trái
      small(["tail@R"], ["tail-short@R"]), // đuôi ngắn
      small([], ["bell@C"]), // thêm chuông ở cổ
    ],
  },
  // Xương rồng trong chậu: nhánh cao bên trái, nhánh thấp bên phải, hoa trên đỉnh.
  cactus: {
    base: ["pot@C", "stem@C", "arm-high@L", "arm-low@R", "flower@C"],
    decoys: [
      big(["arm-high@L"]), // mất nhánh cao
      big(["arm-low@R"]), // mất nhánh thấp
      small(["flower@C"]), // mất hoa
      small(["pot@C"], ["pot-straight@C"]), // chậu thẳng thay chậu loe
      small(["arm-high@L"], ["arm-high-short@L"]), // nhánh cao ngắn lại
      small([], ["bud@R"]), // thêm nụ nhỏ bên phải thân
    ],
  },
  // Cái ô mở: tán 4 múi, cán móc cong sang phải, dây buộc thõng bên trái.
  umbrella: {
    base: ["canopy@C", "tip@C", "shaft@C", "hook@R", "strap@L"],
    decoys: [
      big(["hook@R"]), // cán thẳng, không móc
      big(["canopy@C"], ["canopy-flat@C"]), // tán phẳng mép thẳng
      small(["tip@C"]), // mất chóp
      small(["strap@L"]), // mất dây buộc
      small(["hook@R"], ["hook-small@R"]), // móc nhỏ
      small(["strap@L"], ["strap@R"]), // dây buộc sang bên phải
    ],
  },
  // Gà quay đầu sang phải, đuôi bên trái.
  chicken: {
    base: ["body@R", "comb@R", "beak@R", "wattle@R", "tail@L", "legs@R"],
    decoys: [
      big(["tail@L"]), // mất đuôi
      big([], ["wing-up@R"]), // cánh dang lên trên lưng
      small(["comb@R"]), // mất mào
      small(["wattle@R"]), // mất yếm
      small(["beak@R"], ["beak-open@R"]), // mỏ há
      small(["legs@R"], ["leg-one@R"]), // đứng một chân
    ],
  },
  // Giày thể thao, mũi giày hướng sang phải.
  shoe: {
    base: ["sole@R", "upper@R", "heel-tab@L", "laces@R"],
    decoys: [
      big(["upper@R"], ["upper-high@R"]), // cổ cao như bốt
      big(["sole@R"], ["sole-heel@R"]), // đế có gót cao
      small(["laces@R"]), // mất nơ dây
      small(["heel-tab@L"]), // mất gờ gót
      small([], ["cleats@R"]), // thêm đinh dưới đế
      small(["laces@R"], ["laces-long@R"]), // dây thõng dài
    ],
  },
  // Đèn bàn: cần gập và chụp hướng sang phải, nút và dây điện bên trái đế.
  lamp: {
    base: ["base@C", "arm@R", "joint@R", "shade@R", "switch@L", "cord@L"],
    decoys: [
      big(["arm@R", "joint@R"], ["arm-straight@C"]), // cần thẳng đứng
      big(["base@C"], ["base-tall@C"]), // đế cao dạng khối
      small(["switch@L"]), // mất nút bấm
      small(["joint@R"]), // mất khớp tròn
      small(["cord@L"]), // mất dây điện
      small([], ["bulb@R"]), // bóng đèn ló dưới chụp
    ],
  },
};

/** Danh sách phần hình (đã sắp xếp) của `variant` (0 = hình gốc). */
export function shadowParts(item: ShadowItem, variant: number): ShadowPart[] {
  const def = SHADOW_ITEM_DEFS[item];
  if (variant === 0) return [...def.base].sort();
  const decoy = def.decoys[variant - 1];
  if (!decoy) throw new Error(`shadowParts: ${item} không có biến thể ${variant}`);
  const kept = def.base.filter((p) => !decoy.remove.includes(p));
  return [...kept, ...decoy.add].sort();
}

/**
 * Phần khác nhau giữa biến thể và hình gốc của CÙNG vật, để FE khoanh chi tiết khi trả lời sai:
 * `missing` = phần hình gốc có mà mồi thiếu, `extra` = phần mồi có mà hình gốc không có.
 */
export function shadowDiff(
  item: ShadowItem,
  variant: number,
): { missing: ShadowPart[]; extra: ShadowPart[] } {
  const base = shadowParts(item, 0);
  const parts = shadowParts(item, variant);
  return {
    missing: base.filter((p) => !parts.includes(p)),
    extra: parts.filter((p) => !base.includes(p)),
  };
}

/** Cỡ chi tiết khác biệt của biến thể (biến thể 0 không có). */
export function shadowDetailSize(item: ShadowItem, variant: number): ShadowDetailSize | null {
  return variant === 0 ? null : (SHADOW_ITEM_DEFS[item].decoys[variant - 1]?.size ?? null);
}

function mirrorPart(part: ShadowPart): ShadowPart {
  if (part.endsWith("@L")) return `${part.slice(0, -2)}@R` as ShadowPart;
  if (part.endsWith("@R")) return `${part.slice(0, -2)}@L` as ShadowPart;
  return part;
}

/**
 * Khoá hình dạng KHÔNG phụ thuộc xoay/lật: hai bóng có cùng khoá khi và chỉ khi trông giống hệt
 * nhau sau một phép xoay 90°·k và/hoặc lật gương. Dùng để kiểm tính duy nhất của đáp án.
 */
export function shadowShapeKey(item: ShadowItem, variant: number): string {
  const parts = shadowParts(item, variant);
  const direct = `${item}:${parts.join(",")}`;
  const mirrored = `${item}:${parts.map(mirrorPart).sort().join(",")}`;
  return direct < mirrored ? direct : mirrored;
}
