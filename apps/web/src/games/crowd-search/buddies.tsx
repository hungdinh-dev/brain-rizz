import { type AccessorySlot, type Buddy, type BuddyAttr, CROWD_SPECIES } from "@brain-rizz/shared";
import type { ReactNode } from "react";
import { BODY_PATH, CHARACTER_SPECS, type CharacterSpec, INK } from "@/components/characters/specs";

/*
 * Hình một bạn của Tìm bạn (đặc tả docs/04-minigames/crowd-search.md, mục "Nhân vật & phụ kiện").
 * Vẽ bằng phần tử SVG cơ bản (path, circle, ellipse, rect, g) trong hệ toạ độ 200×200 của bộ nhân
 * vật: thân, tai, đuôi, mảng lông, mũi lấy thẳng từ CHARACTER_SPECS (ADR 0009); mắt, má, miệng, tay
 * và phụ kiện vẽ ở đây. Một nguồn cho hai nơi: scene vẽ lên canvas 2D (_shared/canvas-svg.ts) rồi tạo
 * texture, hình minh hoạ hướng dẫn đặt thẳng vào <svg>. Không asset ngoài.
 *
 * Mỗi kiểu phụ kiện khác nhau về HÌNH (tam giác cao / tấm dẹt + tua / răng cưa; bầu dục trên dây /
 * chữ nhật trước bụng / tam giác trên cán; vòng rỗng / vuông đặc), màu cố định theo kiểu chỉ để
 * nhận nhanh hơn.
 *
 * Không gom với bộ vẽ bạn của Cổng luật (`rule-gate/art.ts` + `shapes.ts`) dù cùng ý "bạn có phụ
 * kiện": bên đó vẽ thẳng Path2D theo bản chép tay riêng (3 loài, mèo không đuôi có ria, mũ lưỡi
 * trai, kính r 17, sách / bóng, viền nhãn dán bằng nét trắng) còn đây là cây SVG từ CHARACTER_SPECS
 * với bộ phụ kiện khác hẳn. Chung một nguồn sẽ đổi hình ít nhất một game.
 */

/** Khung vuông bao mọi tổ hợp (đơn vị hình): chóp mũ tiệc, bóng bay, cờ ở trên; chân chạm đáy. */
export const ART = { x: -24, y: -50, size: 248 } as const;

/** Elip [tâm x, tâm y, bán trục x, bán trục y] theo đơn vị hình. */
export type ArtEllipse = readonly [cx: number, cy: number, rx: number, ry: number];
/** Hộp [x, y, rộng, cao] theo đơn vị hình. */
export type ArtBox = readonly [x: number, y: number, w: number, h: number];

const ink = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** Màu cố định của từng kiểu phụ kiện (màu vẽ riêng của game, không phải token giao diện). */
const COLOR = {
  partyCone: "#7fd1ae",
  partyStripe: "#e85d75",
  gold: "#ffd166",
  gradBoard: "#7768ae",
  gradBand: "#5e5391",
  jewel: "#e85d75",
  jewelBand: "#7fd1ae",
  balloon: "#e85d75",
  shine: "#fff8ef",
  bookCover: "#4d9de0",
  bookSpine: "#3b7fc0",
  pole: "#a8693b",
  flag: "#3bb273",
  frames: "#4d9de0",
  /** Viền phấn quanh tròng kính râm của gấu trúc, để không chìm vào mảng mắt đen. */
  pandaRim: "#c9c6dc",
} as const;

const HAT = { party: 1, grad: 2, crown: 3 } as const;
const HELD = { balloon: 1, book: 2, flag: 3 } as const;
const GLASSES = { round: 1, shades: 2 } as const;

/** Tâm hai tròng kính (cố định cho mọi loài để hình kính giống hệt nhau giữa các loài). */
const LENS_X = [75, 125] as const;
/** Chỗ tay phải (bên trái màn hình) cầm bóng bay / cán cờ. */
const GRIP = [42, 146] as const;

export function specOf(species: number): CharacterSpec {
  return CHARACTER_SPECS[CROWD_SPECIES[species] ?? CROWD_SPECIES[0]];
}

const isPanda = (species: number) => CROWD_SPECIES[species] === "tron";

// ---------------------------------------------------------------- mặt

function eye(spec: CharacterSpec, x: number): ReactNode {
  const y = spec.eyeY;
  switch (spec.eyes) {
    case "amber":
      return (
        <>
          <circle cx={x} cy={y} r={12} fill="#f2a33a" stroke={INK} strokeWidth={4} />
          <circle cx={x} cy={y + 1} r={6.5} fill={INK} />
          <circle cx={x - 3} cy={y - 3} r={2.8} fill="#fff" />
        </>
      );
    case "dark":
      return (
        <>
          <circle cx={x} cy={y} r={10} fill="#2a1f2e" />
          <circle cx={x - 3.5} cy={y - 4} r={3.6} fill="#fff" />
          <circle cx={x + 3.5} cy={y + 4} r={1.6} fill="#fff" />
        </>
      );
    case "panda":
      return (
        <>
          <circle cx={x} cy={y} r={5} fill="#fff" />
          <circle cx={x + 1} cy={y + 0.5} r={3} fill={INK} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx={x} cy={y} rx={6} ry={7.5} fill={INK} />
          <circle cx={x - 2} cy={y - 3} r={2.2} fill="#fff" />
        </>
      );
  }
}

function face(spec: CharacterSpec): ReactNode {
  const [bl, br] = spec.blushX;
  const blush = { rx: 9, ry: 5, fill: spec.blush, opacity: 0.85 };
  return (
    <>
      <ellipse cx={bl} cy={spec.blushY} {...blush} />
      <ellipse cx={br} cy={spec.blushY} {...blush} />
      {eye(spec, spec.eyeX[0])}
      {eye(spec, spec.eyeX[1])}
    </>
  );
}

function mouth(spec: CharacterSpec): ReactNode {
  if (spec.beak) {
    // Mỏ gà con luôn vẽ sau kính và mũ, nên luôn thấy.
    return (
      <>
        <path d="M90 116 L100 108 L110 116 L100 125 Z" fill="#f2a541" strokeWidth={3.5} {...ink} />
        <path d="M91 116 L109 116" fill="none" strokeWidth={2.5} {...ink} />
      </>
    );
  }
  if (spec.idleMouth) return spec.idleMouth;
  return (
    <path
      d="M91 125 C93 130 98 130 100 126 C102 130 107 130 109 125"
      transform={`translate(0 ${spec.mouthY - 125})`}
      fill="none"
      strokeWidth={3.5}
      {...ink}
    />
  );
}

function paws(spec: CharacterSpec, held: number): ReactNode {
  const paw = (x: number, y: number) => (
    <ellipse cx={x} cy={y} rx={12} ry={9} fill={spec.limb} stroke={INK} strokeWidth={4} />
  );
  const foot = (x: number) => (
    <ellipse cx={x} cy={184} rx={16} ry={8} fill={spec.limb} stroke={INK} strokeWidth={5} />
  );
  // Tay phải (bên trái màn hình) cầm đồ; sách cầm cả hai tay trước bụng.
  const right =
    held === HELD.book ? paw(68, 154) : held === 0 ? paw(88, 166) : paw(GRIP[0], GRIP[1]);
  const left = held === HELD.book ? paw(132, 154) : paw(112, 166);
  return (
    <>
      {right}
      {left}
      {foot(72)}
      {foot(128)}
    </>
  );
}

// ---------------------------------------------------------------- mũ

/** Nửa bề rộng mũ chóp ở độ cao y (đáy rộng 60 ở y 46, chóp ở y −34). */
const coneHalf = (y: number) => (30 * (y + 34)) / 80;
const coneBand = (y1: number, y2: number) => {
  const [a, b] = [coneHalf(y1), coneHalf(y2)];
  return `M${100 - a} ${y1} L${100 + a} ${y1} L${100 + b} ${y2} L${100 - b} ${y2} Z`;
};
const CONE = "M70 46 Q100 56 130 46 L100 -34 Z";

/** Mũ chóp tiệc: tam giác cao có sọc, quả bông ở đỉnh. */
const partyHat = (
  <>
    <path d={CONE} fill={COLOR.partyCone} />
    <path d={coneBand(-12, 0)} fill={COLOR.partyStripe} />
    <path d={coneBand(16, 28)} fill={COLOR.partyStripe} />
    <path d={CONE} fill="none" strokeWidth={5} {...ink} />
    <circle cx={100} cy={-38} r={10} fill={COLOR.gold} stroke={INK} strokeWidth={4} />
  </>
);

/**
 * Mũ tốt nghiệp, phần sau: tấm vuông dẹt rộng hơn đầu. Vẽ trước tai và thân để tai (thỏ, cáo) vẫn
 * thấy, như tai xỏ qua mũ; phần chỏm + tua vẽ sau cùng (`gradFront`).
 */
const gradBoard = (
  <path d="M100 -4 L172 16 L100 36 L28 16 Z" fill={COLOR.gradBoard} strokeWidth={5} {...ink} />
);
/** Mũ tốt nghiệp, phần trước: chỏm ôm đầu, nút giữa tấm, tua rủ bên phải màn hình. */
const gradFront = (
  <>
    <path
      d="M72 28 L100 36 L128 28 L128 44 Q100 52 72 44 Z"
      fill={COLOR.gradBand}
      strokeWidth={4.5}
      {...ink}
    />
    <path d="M100 16 L156 24 L156 58" fill="none" strokeWidth={8} {...ink} />
    <path d="M100 16 L156 24 L156 58" fill="none" stroke={COLOR.gold} strokeWidth={4} />
    <path d="M149 56 L163 56 L168 82 L144 82 Z" fill={COLOR.gold} strokeWidth={3.5} {...ink} />
    <circle cx={100} cy={16} r={5} fill={COLOR.gold} stroke={INK} strokeWidth={2.5} />
  </>
);

/** Vương miện: dải thấp ba răng cưa, đá quý ở đầu răng. */
const crown = (
  <>
    <path
      d="M66 46 L66 30 L72 6 L86 26 L100 0 L114 26 L128 6 L134 30 L134 46 Q100 52 66 46 Z"
      fill={COLOR.gold}
      strokeWidth={4.5}
      {...ink}
    />
    <path d="M67 33 Q100 39 133 33" fill="none" strokeWidth={3} {...ink} />
    <circle cx={72} cy={8} r={4} fill={COLOR.jewel} stroke={INK} strokeWidth={2} />
    <circle cx={100} cy={3} r={4.5} fill={COLOR.jewel} stroke={INK} strokeWidth={2} />
    <circle cx={128} cy={8} r={4} fill={COLOR.jewel} stroke={INK} strokeWidth={2} />
    <circle cx={100} cy={42} r={4} fill={COLOR.jewelBand} stroke={INK} strokeWidth={2} />
  </>
);

// ---------------------------------------------------------------- đồ cầm

/** Bóng bay: bầu dục trên dây, đỉnh cao hơn tai, dây từ tay phải. */
const balloon = (
  <>
    <path d="M44 142 C30 110 12 76 20 34" fill="none" strokeWidth={2.5} {...ink} />
    <path d="M15 39 L20 32 L25 39 Z" fill={COLOR.balloon} strokeWidth={2.5} {...ink} />
    <ellipse cx={20} cy={4} rx={23} ry={28} fill={COLOR.balloon} stroke={INK} strokeWidth={4.5} />
    <ellipse
      cx={11}
      cy={-8}
      rx={5}
      ry={9}
      transform="rotate(20 11 -8)"
      fill={COLOR.shine}
      opacity={0.8}
    />
  </>
);

/** Quyển sách: hình chữ nhật trước bụng, gáy bên trái, nhãn trên bìa. */
const book = (
  <>
    <rect x={66} y={128} width={68} height={48} rx={5} fill={COLOR.bookCover} />
    <rect x={68} y={130} width={11} height={44} fill={COLOR.bookSpine} />
    <rect
      x={66}
      y={128}
      width={68}
      height={48}
      rx={5}
      fill="none"
      stroke={INK}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
    <path d="M79 130 L79 174" fill="none" strokeWidth={3} {...ink} />
    <rect
      x={89}
      y={140}
      width={34}
      height={12}
      rx={2}
      fill={COLOR.shine}
      stroke={INK}
      strokeWidth={2.5}
    />
  </>
);

/** Lá cờ: cán dọc cao hơn đầu, cờ tam giác bay ra ngoài. */
const flag = (
  <>
    <path d="M40 178 L40 -28" fill="none" strokeWidth={9} {...ink} />
    <path d="M40 178 L40 -28" {...ink} fill="none" stroke={COLOR.pole} strokeWidth={4.5} />
    <path d="M42 -26 L42 12 L-14 -7 Z" fill={COLOR.flag} strokeWidth={4.5} {...ink} />
    <circle cx={40} cy={-31} r={5} fill={COLOR.gold} stroke={INK} strokeWidth={2.5} />
  </>
);

// ---------------------------------------------------------------- kính

function glasses(kind: number, y: number, panda: boolean): ReactNode {
  const [l, r] = LENS_X;
  const arms = (
    <path
      d={`M${l - 21} ${y - 2} L36 ${y - 6} M${r + 21} ${y - 2} L164 ${y - 6}`}
      fill="none"
      strokeWidth={3.5}
      {...ink}
    />
  );
  if (kind === GLASSES.round) {
    // Hai vòng gọng rỗng: viền mực dưới, gọng xanh trên (vẫn thấy trên mảng mắt đen).
    const ring = { r: 19, fill: "none" } as const;
    const bridge = `M94 ${y - 3} Q100 ${y - 9} 106 ${y - 3}`;
    return (
      <>
        {arms}
        <circle cx={l} cy={y} {...ring} stroke={INK} strokeWidth={10} />
        <circle cx={r} cy={y} {...ring} stroke={INK} strokeWidth={10} />
        <path d={bridge} fill="none" strokeWidth={8} {...ink} />
        <circle cx={l} cy={y} {...ring} stroke={COLOR.frames} strokeWidth={5} />
        <circle cx={r} cy={y} {...ring} stroke={COLOR.frames} strokeWidth={5} />
        <path d={bridge} fill="none" stroke={COLOR.frames} strokeWidth={4} strokeLinecap="round" />
      </>
    );
  }
  // Kính râm: hai tròng vuông tô đặc, vệt sáng chéo.
  const lens = (x: number) => (
    <rect
      x={x - 22}
      y={y - 19}
      width={44}
      height={38}
      rx={7}
      fill={INK}
      stroke={INK}
      strokeWidth={4}
    />
  );
  const rim = (x: number) => (
    <rect
      x={x - 19}
      y={y - 16}
      width={38}
      height={32}
      rx={5}
      fill="none"
      stroke={COLOR.pandaRim}
      strokeWidth={3}
    />
  );
  const shine = (x: number) => `M${x - 14} ${y - 4} L${x - 5} ${y - 13}`;
  return (
    <>
      {arms}
      {lens(l)}
      {lens(r)}
      {panda && rim(l)}
      {panda && rim(r)}
      <path d={`M97 ${y - 8} L103 ${y - 8}`} fill="none" strokeWidth={5} {...ink} />
      <path
        d={`${shine(l)} ${shine(r)}`}
        fill="none"
        stroke={COLOR.shine}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.85}
      />
    </>
  );
}

// ---------------------------------------------------------------- ghép

const HAT_FRONT: Readonly<Record<number, ReactNode>> = {
  [HAT.party]: partyHat,
  [HAT.grad]: gradFront,
  [HAT.crown]: crown,
};
const HELD_ART: Readonly<Record<number, ReactNode>> = {
  [HELD.balloon]: balloon,
  [HELD.book]: book,
  [HELD.flag]: flag,
};

/**
 * Cả một bạn, đứng trong khung `ART` (chân ở đáy). Thứ tự: tấm mũ tốt nghiệp → phía sau (tai,
 * đuôi) → thân → mảng lông → viền → phía trước (tai trước, cánh) → má, mắt → kính → mũi, miệng →
 * đồ cầm → tay, chân → mũ.
 */
export function buddyArt(b: Buddy): ReactNode {
  const spec = specOf(b.species);
  return (
    <>
      {b.hat === HAT.grad && gradBoard}
      {spec.back(false)}
      <path d={BODY_PATH} fill={spec.fill} />
      {spec.patches}
      <path d={BODY_PATH} fill="none" stroke={INK} strokeWidth={6} />
      {spec.front}
      {face(spec)}
      {b.glasses !== 0 && glasses(b.glasses, spec.eyeY, isPanda(b.species))}
      {spec.nose}
      {mouth(spec)}
      {HELD_ART[b.held]}
      {spec.paws && paws(spec, b.held)}
      {HAT_FRONT[b.hat]}
    </>
  );
}

/** Riêng một món (chip món bị gạch trên thẻ), cùng hình như trên người bạn loài `species`. */
export function accessoryArt(slot: AccessorySlot, value: number, species: number): ReactNode {
  if (slot === "glasses") return glasses(value, specOf(species).eyeY, isPanda(species));
  if (slot === "held") return HELD_ART[value];
  return (
    <>
      {value === HAT.grad && gradBoard}
      {HAT_FRONT[value]}
    </>
  );
}

/** Hộp bao một món (để canh giữa trong chip). Bóng bay và cờ cắt bớt dây / cán. */
export function accessoryBox(slot: AccessorySlot, value: number, species: number): ArtBox {
  if (slot === "glasses") return [50, specOf(species).eyeY - 24, 100, 48];
  if (slot === "held") {
    if (value === HELD.balloon) return [-6, -26, 52, 80];
    if (value === HELD.book) return [62, 124, 76, 56];
    return [-18, -38, 64, 84];
  }
  if (value === HAT.party) return [66, -50, 68, 104];
  if (value === HAT.grad) return [24, -8, 152, 92];
  return [62, -4, 76, 56];
}

/**
 * Vùng khoanh khi một thuộc tính lệch thẻ (elip, đơn vị hình). `value` là kiểu món nằm ở vùng đó:
 * món của bạn bị chạm nếu có, không thì món trên thẻ (khoanh chỗ đáng lẽ có món).
 */
export function focusArea(attr: BuddyAttr, value: number, species: number): ArtEllipse {
  if (attr === "species") return [100, 108, 76, 68];
  if (attr === "glasses") return [100, specOf(species).eyeY, 62, 30];
  if (attr === "held") {
    if (value === HELD.balloon) return [20, 10, 34, 38];
    if (value === HELD.book) return [100, 152, 46, 34];
    return [16, -4, 40, 34];
  }
  if (value === HAT.party) return [100, -2, 38, 54];
  if (value === HAT.grad) return [100, 26, 80, 40];
  return [100, 24, 44, 30];
}
