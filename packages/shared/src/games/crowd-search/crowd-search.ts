import type { CharacterId } from "../../constants";
import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Tìm bạn (đặc tả: docs/04-minigames/crowd-search.md).
 * Thẻ "tìm người" vẽ một bạn (loài + mũ + đồ cầm + kính); người chơi chạm đúng bạn đó giữa
 * đám đông đứng yên. Siêu khó thêm một món bị gạch chéo: bạn cần tìm không có món đó.
 *
 * Bất biến: thẻ vẽ đúng nguyên dạng bạn cần tìm, và **chỉ một bạn** trong đám đông có đủ mọi thứ
 * vẽ trên thẻ (trừ bẫy ở Siêu khó, là những bạn có thêm đúng món bị gạch). Nhờ vậy đọc luật kiểu
 * "giống hệt thẻ", "có đủ những gì trên thẻ" hay "không có món bị gạch" đều ra cùng một đáp án.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`, không dùng Math.random() hay Date.now(). Chỉ dùng số nguyên.
 */

/**
 * Loài theo chỉ số: 6 nhân vật của Brain Rizz (ADR 0009), vẽ lại bằng Phaser Graphics.
 * Danh sách cố định riêng cho game (không đọc `CHARACTER_IDS`) để thêm avatar mới không làm đổi
 * câu đố đã sinh. 0 Khói (mèo) · 1 Bơ (chó) · 2 Mochi (thỏ) · 3 Bắp (gà con) · 4 Cam (cáo) ·
 * 5 Tròn (gấu trúc).
 */
export const CROWD_SPECIES = [
  "khoi",
  "bo",
  "mochi",
  "bap",
  "cam",
  "tron",
] as const satisfies readonly CharacterId[];

/** Ba ô phụ kiện của một bạn. */
export type AccessorySlot = "hat" | "held" | "glasses";
/** Bốn thuộc tính của một bạn. */
export type BuddyAttr = "species" | AccessorySlot;

export const ACCESSORY_SLOTS: readonly AccessorySlot[] = ["hat", "held", "glasses"];
export const BUDDY_ATTRS: readonly BuddyAttr[] = ["species", ...ACCESSORY_SLOTS];

/**
 * Số kiểu của mỗi thuộc tính. Loài: 0…5 (theo `CROWD_SPECIES`). Phụ kiện: 0 = không có, 1…n là
 * kiểu, phân biệt bằng hình (không chỉ bằng màu):
 * - `hat`: 1 mũ chóp tiệc (tam giác cao) · 2 mũ tốt nghiệp (tấm vuông dẹt + tua) · 3 vương miện
 *   (ba răng cưa thấp)
 * - `held`: 1 bóng bay (hình tròn trên dây, cao quá vai) · 2 quyển sách (hình chữ nhật trước
 *   bụng) · 3 lá cờ (cán dọc + cờ tam giác)
 * - `glasses`: 1 kính tròn (hai vòng gọng rỗng) · 2 kính râm (hai tròng vuông tô đặc)
 */
export const BUDDY_VARIANTS: Readonly<Record<BuddyAttr, number>> = {
  species: CROWD_SPECIES.length,
  hat: 3,
  held: 3,
  glasses: 2,
};

/** Một bạn trong đám đông: toàn số nguyên, không có chữ hiển thị. */
export interface Buddy {
  /** 0…5, chỉ số vào `CROWD_SPECIES`. */
  species: number;
  /** 0 = không đội; 1…3 xem `BUDDY_VARIANTS`. */
  hat: number;
  /** 0 = không cầm; 1…3. */
  held: number;
  /** 0 = không đeo; 1…2. */
  glasses: number;
}

/** Món bị gạch chéo trên thẻ (Siêu khó). */
export interface CrowdSearchForbidden {
  slot: AccessorySlot;
  /** Kiểu món bị gạch, 1…`BUDDY_VARIANTS[slot]`. */
  value: number;
}

/** Thẻ "tìm người". */
export interface CrowdSearchCard {
  /**
   * Bạn cần tìm, vẽ nguyên dạng: loài + mọi phụ kiện khác 0. Phụ kiện 0 thì không vẽ.
   * Luôn bằng `crowd[answerIndex]`.
   */
  buddy: Buddy;
  /**
   * Chỉ Siêu khó: món bị gạch chéo, vẽ cạnh bạn trên thẻ. Ô `slot` của bạn cần tìm luôn là 0;
   * các bẫy giống hệt bạn cần tìm nhưng có đúng món này.
   */
  not?: CrowdSearchForbidden;
}

export interface CrowdSearchPuzzle {
  /** Lưới đám đông: `cols` cột × `rows` hàng. */
  cols: number;
  rows: number;
  /** Đám đông theo thứ tự ô: trái → phải, trên → dưới; dài đúng `cols × rows`. */
  crowd: Buddy[];
  card: CrowdSearchCard;
  /** Ô của bạn cần tìm. */
  answerIndex: number;
}

/** Đáp án = chỉ số ô người chơi chạm trong `crowd`, gửi một lần mỗi câu. */
export type CrowdSearchAnswer = number;

interface LevelParams {
  cols: number;
  rows: number;
  /** Số phụ kiện bạn cần tìm mang (đều vẽ trên thẻ). */
  accessories: number;
  /** Thẻ có món bị gạch chéo không (gạch ở ô phụ kiện bạn cần tìm để trống). */
  forbidden: boolean;
  /** Bạn cùng loài, lệch đúng một phụ kiện có trên thẻ (đổi kiểu khác hoặc bỏ đi). */
  sameSpeciesNear: number;
  /** Bạn khác loài, phụ kiện y hệt bạn cần tìm. */
  otherSpeciesNear: number;
  /** Bẫy (Siêu khó): giống hệt bạn cần tìm nhưng có thêm đúng món bị gạch. */
  traps: number;
  /** Bạn ngẫu nhiên còn lại có được trùng loài với bạn cần tìm không. */
  fillerSameSpecies: boolean;
  /** Xác suất (%) mỗi ô phụ kiện của bạn ngẫu nhiên có món. */
  fillerAccessoryPct: number;
}

const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: {
    cols: 3,
    rows: 3,
    accessories: 1,
    forbidden: false,
    sameSpeciesNear: 0,
    otherSpeciesNear: 0,
    traps: 0,
    fillerSameSpecies: false,
    fillerAccessoryPct: 35,
  },
  1: {
    cols: 4,
    rows: 4,
    accessories: 2,
    forbidden: false,
    sameSpeciesNear: 3,
    otherSpeciesNear: 2,
    traps: 0,
    fillerSameSpecies: false,
    fillerAccessoryPct: 45,
  },
  2: {
    cols: 5,
    rows: 5,
    accessories: 3,
    forbidden: false,
    sameSpeciesNear: 5,
    otherSpeciesNear: 3,
    traps: 0,
    fillerSameSpecies: true,
    fillerAccessoryPct: 55,
  },
  3: {
    cols: 5,
    rows: 6,
    accessories: 2,
    forbidden: true,
    sameSpeciesNear: 4,
    otherSpeciesNear: 3,
    traps: 2,
    fillerSameSpecies: true,
    fillerAccessoryPct: 55,
  },
};

/** Kích thước lưới theo mức (cột × hàng): 3×3 · 4×4 · 5×5 · 5×6. */
export const CROWD_SEARCH_GRID: Readonly<Record<Difficulty, { cols: number; rows: number }>> = {
  0: { cols: LEVELS[0].cols, rows: LEVELS[0].rows },
  1: { cols: LEVELS[1].cols, rows: LEVELS[1].rows },
  2: { cols: LEVELS[2].cols, rows: LEVELS[2].rows },
  3: { cols: LEVELS[3].cols, rows: LEVELS[3].rows },
};

/** Số bạn tối đa trong đám đông (Siêu khó 5×6), cũng là chặn trên của đáp án. */
export const CROWD_SEARCH_MAX_CROWD = 30;

const SPECIES_INDICES: readonly number[] = CROWD_SPECIES.map((_, i) => i);

function withAttr(b: Buddy, attr: BuddyAttr, value: number): Buddy {
  const out = { ...b };
  out[attr] = value;
  return out;
}

/**
 * Những thuộc tính làm bạn `b` KHÔNG khớp thẻ: loài khác; thiếu hoặc khác kiểu một món vẽ trên
 * thẻ; có món bị gạch. Mảng rỗng = khớp. FE dùng để khoanh chi tiết sai khi người chơi chạm nhầm.
 */
export function crowdSearchMismatch(b: Buddy, card: CrowdSearchCard): BuddyAttr[] {
  const out: BuddyAttr[] = [];
  if (b.species !== card.buddy.species) out.push("species");
  for (const slot of ACCESSORY_SLOTS) {
    const want = card.buddy[slot];
    if (want !== 0 && b[slot] !== want) out.push(slot);
    else if (card.not?.slot === slot && b[slot] === card.not.value) out.push(slot);
  }
  return out;
}

/** Bạn `b` có đủ mọi thứ vẽ trên thẻ và không có món bị gạch. */
export function matchesCard(b: Buddy, card: CrowdSearchCard): boolean {
  return crowdSearchMismatch(b, card).length === 0;
}

/** Có đủ loài và mọi món vẽ trên thẻ (chưa xét món bị gạch). */
function hasEverythingOnCard(b: Buddy, card: CrowdSearchCard): boolean {
  if (b.species !== card.buddy.species) return false;
  return ACCESSORY_SLOTS.every((slot) => card.buddy[slot] === 0 || b[slot] === card.buddy[slot]);
}

/**
 * Một bạn ngẫu nhiên. Mức không cho trùng loài thì chỉ bốc trong `otherSpecies` (các loài khác
 * loài cần tìm, đã xáo): lượt đầu phủ đủ mỗi loài một lần, sau đó bốc ngẫu nhiên.
 */
function randomFiller(
  rng: Rng,
  level: LevelParams,
  otherSpecies: readonly number[],
  i: number,
): Buddy {
  const species = level.fillerSameSpecies
    ? rng.int(0, BUDDY_VARIANTS.species - 1)
    : (otherSpecies[i] ?? rng.pick(otherSpecies));
  const b: Buddy = { species, hat: 0, held: 0, glasses: 0 };
  for (const slot of ACCESSORY_SLOTS) {
    if (rng.int(1, 100) <= level.fillerAccessoryPct) b[slot] = rng.int(1, BUDDY_VARIANTS[slot]);
  }
  return b;
}

export const crowdSearch: MinigameDef<CrowdSearchPuzzle, CrowdSearchAnswer> = {
  id: "crowd-search",
  category: "identify",
  durationMs: 60_000,
  // Bảng Cân bằng trong đặc tả: điểm vòng người lớn ở mỗi mức ≈ người lớn ở Thường.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 2.2, 3: 3.45 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): giữa
  // khoảng + 0,3 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 2_900, 1: 2_800, 2: 4_300, 3: 5_700 },
  // Bot (CR-016): tỉ lệ đúng chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.93, 2: 0.88, 3: 0.84 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const total = level.cols * level.rows;

    // 1. Bạn cần tìm: loài + `accessories` phụ kiện ở các ô bốc ngẫu nhiên.
    const species = rng.int(0, BUDDY_VARIANTS.species - 1);
    const slots = rng.shuffle(ACCESSORY_SLOTS);
    const worn = slots.slice(0, level.accessories);
    let answer: Buddy = { species, hat: 0, held: 0, glasses: 0 };
    for (const slot of worn) answer = withAttr(answer, slot, rng.int(1, BUDDY_VARIANTS[slot]));
    const card: CrowdSearchCard = { buddy: { ...answer } };
    const emptySlot = slots[level.accessories];
    if (level.forbidden && emptySlot !== undefined) {
      card.not = { slot: emptySlot, value: rng.int(1, BUDDY_VARIANTS[emptySlot]) };
    }

    const others: Buddy[] = [];

    // 2. Cùng loài, lệch đúng một món có trên thẻ (đổi kiểu hoặc bỏ đi), các biến thể khác nhau.
    const variations: Buddy[] = [];
    for (const slot of worn) {
      for (let v = 0; v <= BUDDY_VARIANTS[slot]; v++) {
        if (v !== answer[slot]) variations.push(withAttr(answer, slot, v));
      }
    }
    others.push(...rng.shuffle(variations).slice(0, level.sameSpeciesNear));

    // 3. Khác loài, phụ kiện y hệt (các loài khác nhau).
    const otherSpecies = rng.shuffle(SPECIES_INDICES.filter((s) => s !== species));
    for (let i = 0; i < level.otherSpeciesNear; i++) {
      others.push(withAttr(answer, "species", otherSpecies[i] ?? 0));
    }

    // 4. Bẫy: giống hệt bạn cần tìm, thêm đúng món bị gạch.
    if (card.not) {
      for (let i = 0; i < level.traps; i++) {
        others.push(withAttr(answer, card.not.slot, card.not.value));
      }
    }

    // 5. Bạn ngẫu nhiên lấp đủ lưới. Sinh xong mới kiểm: bạn nào có đủ mọi thứ trên thẻ thì đổi
    //    sang loài khác, để ngoài bạn cần tìm chỉ có bẫy có chủ đích là có đủ mọi thứ trên thẻ.
    const fillerCount = total - 1 - others.length;
    for (let i = 0; i < fillerCount; i++) {
      const b = randomFiller(rng, level, otherSpecies, i);
      if (hasEverythingOnCard(b, card)) {
        b.species = (species + rng.int(1, BUDDY_VARIANTS.species - 1)) % BUDDY_VARIANTS.species;
      }
      others.push(b);
    }

    // 6. Xáo vị trí.
    const crowd = rng.shuffle([answer, ...others]);
    return {
      cols: level.cols,
      rows: level.rows,
      crowd,
      card,
      answerIndex: crowd.indexOf(answer),
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is CrowdSearchAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < CROWD_SEARCH_MAX_CROWD
    );
  },
};
