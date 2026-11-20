/**
 * Danh mục phụ kiện (CR-023, docs/01-product/gacha-pets-unlocks.md mục 3.1 và 5.1).
 * Chỉ có id, chỗ đeo, độ hiếm; tên hiển thị nằm ở i18n của web, hình vẽ ở
 * `apps/web/src/components/characters/accessories.tsx`. Seed bảng `cosmetic_items` trong migration
 * Supabase phải khớp danh sách này (test `migration.test.ts` kiểm).
 */

/** Ba chỗ đeo, theo thứ tự hiển thị (đầu, mặt, cổ). Thứ tự lớp khi vẽ do web quyết (mục 5.5). */
export const COSMETIC_SLOTS = ["head", "face", "neck"] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

/** Bốn độ hiếm, từ thường tới hiếm nhất. */
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Tối đa một món mỗi chỗ → tối đa ngần này món trên một nhân vật. */
export const MAX_ACCESSORIES = COSMETIC_SLOTS.length;
/** Độ dài tối đa của một id phụ kiện client gửi lên (zod ở giao thức dùng số này). */
export const MAX_COSMETIC_ID_LENGTH = 40;

/**
 * 24 món: 9 Thường, 8 Hiếm, 4 Sử thi, 3 Huyền thoại. Thứ tự: theo chỗ (đầu, mặt, cổ), trong mỗi
 * chỗ theo độ hiếm tăng dần — web hiển thị lưới tủ đồ và danh sách tỉ lệ theo thứ tự này.
 */
export const COSMETIC_ITEMS = [
  // Đầu
  { id: "beanie", slot: "head", rarity: "common" },
  { id: "bow", slot: "head", rarity: "common" },
  { id: "cap", slot: "head", rarity: "common" },
  { id: "flower-crown", slot: "head", rarity: "rare" },
  { id: "witch-hat", slot: "head", rarity: "rare" },
  { id: "grad-cap", slot: "head", rarity: "rare" },
  { id: "headphones", slot: "head", rarity: "rare" },
  { id: "crown", slot: "head", rarity: "epic" },
  { id: "cowboy", slot: "head", rarity: "epic" },
  { id: "halo", slot: "head", rarity: "legendary" },
  // Mặt
  { id: "round-glasses", slot: "face", rarity: "common" },
  { id: "sunglasses", slot: "face", rarity: "common" },
  { id: "bandage", slot: "face", rarity: "common" },
  { id: "heart-glasses", slot: "face", rarity: "rare" },
  { id: "hero-mask", slot: "face", rarity: "rare" },
  { id: "monocle", slot: "face", rarity: "epic" },
  { id: "star-glasses", slot: "face", rarity: "legendary" },
  // Cổ
  { id: "scarf", slot: "neck", rarity: "common" },
  { id: "bowtie", slot: "neck", rarity: "common" },
  { id: "bell", slot: "neck", rarity: "common" },
  { id: "cape", slot: "neck", rarity: "rare" },
  { id: "lei", slot: "neck", rarity: "rare" },
  { id: "pearls", slot: "neck", rarity: "epic" },
  { id: "royal-cape", slot: "neck", rarity: "legendary" },
] as const satisfies readonly { id: string; slot: CosmeticSlot; rarity: Rarity }[];

export type CosmeticItem = (typeof COSMETIC_ITEMS)[number];
export type CosmeticId = CosmeticItem["id"];

export const COSMETIC_IDS: readonly CosmeticId[] = COSMETIC_ITEMS.map((item) => item.id);

const ITEM_BY_ID: ReadonlyMap<string, CosmeticItem> = new Map(
  COSMETIC_ITEMS.map((item) => [item.id, item]),
);

export function isCosmeticId(value: unknown): value is CosmeticId {
  return typeof value === "string" && ITEM_BY_ID.has(value);
}

/** Món theo id; id lạ → `undefined`. */
export function getCosmetic(id: string): CosmeticItem | undefined {
  return ITEM_BY_ID.get(id);
}

/** Các món của một độ hiếm, theo thứ tự `COSMETIC_ITEMS` (máy quay bốc đều trong danh sách này). */
export function cosmeticsByRarity(rarity: Rarity): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((item) => item.rarity === rarity);
}

/**
 * Bộ phụ kiện hợp lệ từ dữ liệu bất kỳ (hồ sơ trên máy, join options, DB). **Không bao giờ ném.**
 * - Không phải mảng → `[]`; phần tử không phải id trong danh mục bị bỏ.
 * - `owned` (nếu truyền): chỉ giữ món có trong đó — server truyền danh sách món đã sở hữu.
 * - Mỗi chỗ tối đa một món: giữ món **đầu tiên** gặp của chỗ đó.
 * - Kết quả xếp theo `COSMETIC_SLOTS` (đầu, mặt, cổ), không trùng, tối đa `MAX_ACCESSORIES` món,
 *   nên hai bộ cùng món luôn ra cùng một mảng.
 */
export function sanitizeLoadout(
  ids: unknown,
  owned?: Iterable<string> | ReadonlySet<string>,
): CosmeticId[] {
  if (!Array.isArray(ids)) return [];
  const allowed = owned === undefined ? undefined : toSet(owned);
  const bySlot = new Map<CosmeticSlot, CosmeticId>();
  for (const id of ids) {
    if (!isCosmeticId(id)) continue;
    if (allowed && !allowed.has(id)) continue;
    const item = ITEM_BY_ID.get(id);
    if (item && !bySlot.has(item.slot)) bySlot.set(item.slot, item.id);
  }
  const out: CosmeticId[] = [];
  for (const slot of COSMETIC_SLOTS) {
    const id = bySlot.get(slot);
    if (id) out.push(id);
  }
  return out;
}

function toSet(values: Iterable<string> | ReadonlySet<string>): ReadonlySet<string> {
  try {
    return values instanceof Set ? values : new Set(values);
  } catch {
    return new Set();
  }
}
