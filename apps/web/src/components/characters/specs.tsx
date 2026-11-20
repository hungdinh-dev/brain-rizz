import type { CharacterId, CosmeticId } from "@brain-rizz/shared";
import type { ReactNode } from "react";

/**
 * Hình dạng từng nhân vật trong hệ toạ độ 200×200 (bản gốc: canvas thiết kế "Brain Rizz — Màn chờ & Menu").
 * Mọi nhân vật dùng chung một thân tròn (BODY_PATH); khác nhau ở tai, đuôi, mảng lông, kiểu mắt.
 * Biểu cảm (mắt, miệng, tay, hiệu ứng) ghép chung ở Character.tsx nên nhân vật mới tự có đủ 7 biểu cảm.
 */

export const INK = "#1f1b3a";

export const BODY_PATH =
  "M100 34 C144 34 168 62 168 100 C168 128 162 150 150 166 C142 178 124 184 100 184 C76 184 58 178 50 166 C38 150 32 128 32 100 C32 62 56 34 100 34 Z";

export type EyeStyle = "amber" | "dark" | "bead" | "panda";

/**
 * Điểm neo phụ kiện (gacha-pets-unlocks.md mục 5.5), cùng hệ toạ độ 200×200. Món vẽ quanh gốc
 * (0, 0) rồi đặt bằng `translate(x y) rotate(rotate) scale(scale)`.
 */
export interface Anchor {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
}

export interface CharacterAnchors {
  /**
   * Đỉnh đầu, giữa hai tai: đáy món đầu đặt ở đây. Thấp hơn mép viền trên (y = 34) chừng 6 để
   * món đáy phẳng rộng ~60 chạm hai bên đầu tròn thay vì cân trên một điểm.
   */
  head: Anchor;
  /** Neo đầu riêng cho vài món ở loài cần chỉnh (vd. nơ của thỏ nằm giữa hai tai thay vì đè chân tai). */
  headItems?: Partial<Record<CosmeticId, Anchor>>;
  /** Điểm giữa hai mắt; `scale` = khoảng cách hai mắt / 48 (48 là chuẩn của món mặt). */
  face: Anchor;
  /** Tâm cổ: ngay dưới miệng/mỏ, chỗ dây huy chương (biểu cảm thắng) bắt đầu. */
  neck: Anchor;
}

export interface CharacterSpec {
  /** Màu thân */
  fill: string;
  /** Màu bàn chân/tay */
  limb: string;
  /** Màu lông vùng trán: che nửa trên mắt khi tức giận */
  forehead: string;
  eyes: EyeStyle;
  eyeX: [number, number];
  eyeY: number;
  /** Toạ độ y của miệng (miệng chuẩn vẽ quanh y = 125) */
  mouthY: number;
  blush: string;
  blushX: [number, number];
  blushY: number;
  /** Có bàn tay (gà con dùng cánh nên không có) */
  paws: boolean;
  /** Mỏ thay cho miệng */
  beak?: boolean;
  /** Phía sau thân: đuôi, tai sau, chân gà. `animated` để đuôi vẫy */
  back(animated: boolean): ReactNode;
  /**
   * Tai dài (thỏ) — đặc điểm nhận ra loài nên món đầu không được che. Tai vẫn vẽ trong `back`
   * (sau thân); khi đội món đầu, `Character` vẽ lại `art` — chỉ phần nhô khỏi viền thân — đè lên
   * món, nên món trông như đội giữa/sau hai tai. `outline`: hình bao hai tai (một path), dùng để
   * vẽ lại viền đầu ở chân tai.
   */
  ears?: { outline: string; art: ReactNode };
  /** Mảng lông vẽ đè lên màu thân, dưới viền */
  patches?: ReactNode;
  /** Phía trước viền: tai trước, cánh, chỏm lông, ria, quầng mắt */
  front?: ReactNode;
  nose?: ReactNode;
  /** Miệng lúc bình thường, mặc định là chữ ω */
  idleMouth?: ReactNode;
  /** Đạo cụ lúc bình thường (cà rốt của Mochi) */
  idleProp?: ReactNode;
  /** Chỗ đặt phụ kiện đầu / mặt / cổ */
  anchors: CharacterAnchors;
}

const stroke = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const khoi: CharacterSpec = {
  fill: "#8e94a7",
  limb: "#fbfbfd",
  forehead: "#8e94a7",
  eyes: "amber",
  eyeX: [76, 124],
  eyeY: 102,
  mouthY: 125,
  blush: "#f4a3b4",
  blushX: [62, 138],
  blushY: 124,
  paws: true,
  back: () => (
    <path
      d="M146 168 C182 170 198 140 186 112 C180 98 166 100 168 114 C176 138 166 154 140 156 Z"
      fill="#8e94a7"
      strokeWidth={6}
      {...stroke}
    />
  ),
  patches: (
    <g fill="#fbfbfd">
      <path d="M100 120 C122 120 140 136 142 156 C144 174 126 184 100 184 C74 184 56 174 58 156 C60 136 78 120 100 120 Z" />
      <path d="M100 112 C95 96 95 78 100 62 C105 78 105 96 100 112 Z" />
      <path d="M100 108 C112 108 124 114 125 124 C126 134 114 138 100 136 C86 138 74 134 75 124 C76 114 88 108 100 108 Z" />
      {/* Chòm ria xám lệch một bên, đặc điểm của Khói */}
      <path d="M84 124 C88 119 97 120 99 127 C95 132 87 131 84 124 Z" fill="#8e94a7" />
    </g>
  ),
  front: (
    <>
      <path
        d="M33 102 L25 108 L34 111 L27 117 L35 118 M167 102 L175 108 L166 111 L173 117 L165 118"
        fill="none"
        strokeWidth={4}
        {...stroke}
      />
      <path
        d="M52 62 C46 44 60 32 80 38 C74 48 66 56 52 62 Z M148 62 C154 44 140 32 120 38 C126 48 134 56 148 62 Z"
        fill="#7d8396"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M76 121 L56 117 M76 127 L56 128 M124 121 L144 117 M124 127 L144 128"
        strokeWidth={2.5}
        opacity={0.55}
        {...stroke}
      />
    </>
  ),
  nose: <path d="M95 115 L105 115 L100 121 Z" fill="#4b4558" strokeWidth={2.5} {...stroke} />,
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 102, scale: 1 },
    neck: { x: 100, y: 142 },
  },
};

const bo: CharacterSpec = {
  fill: "#fffaf3",
  limb: "#fffaf3",
  forehead: "#fffaf3",
  eyes: "dark",
  eyeX: [76, 124],
  eyeY: 102,
  mouthY: 124,
  blush: "#f7a8b8",
  blushX: [64, 136],
  blushY: 124,
  paws: true,
  back: (animated) => (
    <path
      className={animated ? "fx-wag" : undefined}
      d="M146 162 C176 160 194 134 186 106 C182 94 168 96 170 108 C174 128 164 144 142 148 Z"
      fill="#fffaf3"
      strokeWidth={6}
      {...stroke}
    />
  ),
  patches: (
    <>
      <path d="M140 142 C152 140 162 152 158 166 C148 170 136 160 140 142 Z" fill="#f2b277" />
      <path
        d="M62 60 C68 46 84 40 94 44 C90 56 80 66 64 72 Z M138 60 C132 46 116 40 106 44 C110 56 120 66 136 72 Z"
        fill="#f6cf9f"
      />
    </>
  ),
  front: (
    <>
      <path
        d="M62 48 C42 46 26 64 28 90 C29 104 36 114 46 116 C50 116 52 112 50 106 C48 96 52 84 58 74 C64 64 68 54 62 48 Z M138 48 C158 46 174 64 172 90 C171 104 164 114 154 116 C150 116 148 112 150 106 C152 96 148 84 142 74 C136 64 132 54 138 48 Z"
        fill="#f2b277"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M34 98 L31 106 M40 104 L38 112 M166 98 L169 106 M160 104 L162 112"
        strokeWidth={3}
        {...stroke}
      />
    </>
  ),
  nose: (
    <>
      <path
        d="M92 113 C92 108 108 108 108 113 C108 118 103 121 100 121 C97 121 92 118 92 113 Z"
        fill="#c98676"
        strokeWidth={3}
        {...stroke}
      />
      <ellipse cx={97} cy={111.5} rx={2.2} ry={1.3} fill="#fff" />
    </>
  ),
  idleMouth: (
    <>
      <path d="M95 127 C95 140 105 140 105 127 Z" fill="#f27d93" strokeWidth={3} {...stroke} />
      <path
        d="M88 123 C92 130 98 130 100 125 C102 130 108 130 112 123"
        fill="none"
        strokeWidth={3.5}
        {...stroke}
      />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 102, scale: 1 },
    // Lưỡi thè tới y ≈ 140
    neck: { x: 100, y: 146 },
  },
};

const MOCHI_EARS =
  "M70 52 C58 30 56 8 68 4 C80 0 86 24 86 48 Z M130 52 C142 30 144 8 132 4 C120 0 114 24 114 48 Z";

const mochiEars = (
  <>
    <path d={MOCHI_EARS} fill="#fdfaf6" strokeWidth={5} {...stroke} />
    <path
      d="M72 44 C65 30 64 14 69 10 C75 9 79 26 79 44 Z M128 44 C135 30 136 14 131 10 C125 9 121 26 121 44 Z"
      fill="#f7a8b8"
    />
  </>
);

const mochi: CharacterSpec = {
  fill: "#fdfaf6",
  limb: "#fdfaf6",
  forehead: "#fdfaf6",
  eyes: "bead",
  eyeX: [78, 122],
  eyeY: 104,
  mouthY: 123,
  blush: "#f7a8b8",
  blushX: [62, 138],
  blushY: 122,
  paws: true,
  back: () => (
    <>
      {mochiEars}
      <circle cx={160} cy={166} r={12} fill="#fdfaf6" strokeWidth={5} {...stroke} />
    </>
  ),
  ears: { outline: MOCHI_EARS, art: mochiEars },
  nose: <path d="M96 114 L104 114 L100 119 Z" fill="#f27d93" strokeWidth={2.5} {...stroke} />,
  idleProp: (
    <>
      <path
        d="M86 150 C94 144 106 150 104 160 L86 180 C82 182 78 178 80 174 Z"
        fill="#f2a541"
        strokeWidth={4}
        {...stroke}
      />
      <path
        d="M96 148 C92 138 98 134 101 142 M100 150 C106 140 112 142 108 150"
        fill="none"
        stroke="#3bb273"
        strokeWidth={4.5}
        strokeLinecap="round"
      />
    </>
  ),
  anchors: {
    // Mũ nhỏ lại, tai vẽ đè lên món (`ears`) nên món như đội giữa/sau hai tai
    head: { x: 100, y: 40, scale: 0.85 },
    // Nơ (gốc lệch phải 26) dời về giữa hai tai, xoay thẳng lại: nút nơ ở (100, 31)
    headItems: { bow: { x: 84, y: 42, scale: 0.72, rotate: -16 } },
    face: { x: 100, y: 104, scale: 44 / 48 },
    neck: { x: 100, y: 142 },
  },
};

const bap: CharacterSpec = {
  fill: "#ffd166",
  limb: "#ffd166",
  forehead: "#ffd166",
  eyes: "bead",
  eyeX: [80, 120],
  eyeY: 102,
  mouthY: 125,
  blush: "#f7a8b8",
  blushX: [64, 136],
  blushY: 120,
  paws: false,
  beak: true,
  back: () => (
    <path
      d="M82 182 L76 194 M82 182 L82 195 M82 182 L88 194 M118 182 L112 194 M118 182 L118 195 M118 182 L124 194"
      stroke="#f2a541"
      strokeWidth={5}
      strokeLinecap="round"
    />
  ),
  patches: (
    <path
      d="M100 130 C124 130 140 146 138 164 C136 178 120 182 100 182 C80 182 64 178 62 164 C60 146 76 130 100 130 Z"
      fill="#ffe29a"
    />
  ),
  front: (
    <>
      <path
        d="M38 112 C26 120 24 140 36 148 C42 142 46 128 38 112 Z M162 112 C174 120 176 140 164 148 C158 142 154 128 162 112 Z"
        fill="#f6c04f"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M94 38 C88 24 96 18 100 32 C102 18 112 20 106 38"
        fill="#ffd166"
        strokeWidth={4.5}
        {...stroke}
      />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 102, scale: 40 / 48 },
    neck: { x: 100, y: 140 },
  },
};

const cam: CharacterSpec = {
  fill: "#f08a3c",
  limb: "#5a3a2e",
  forehead: "#f08a3c",
  eyes: "bead",
  eyeX: [78, 122],
  eyeY: 100,
  mouthY: 130,
  blush: "#f7a8b8",
  blushX: [62, 138],
  blushY: 124,
  paws: true,
  back: (animated) => (
    <>
      <g className={animated ? "fx-wag" : undefined}>
        <path
          d="M144 170 C184 172 200 136 182 104 C176 94 164 98 166 110 C172 132 164 150 140 154 Z"
          fill="#f08a3c"
          strokeWidth={6}
          {...stroke}
        />
        <path
          d="M166 110 C164 98 176 94 182 104 C186 112 184 120 178 126 C174 120 170 116 166 110 Z"
          fill="#fffaf3"
          strokeWidth={5}
          {...stroke}
        />
      </g>
      <path
        d="M48 72 L54 22 L92 46 Z M152 72 L146 22 L108 46 Z"
        fill="#f08a3c"
        strokeWidth={5}
        {...stroke}
      />
      <path d="M57 60 L60 34 L82 47 Z M143 60 L140 34 L118 47 Z" fill="#fff1e0" />
    </>
  ),
  patches: (
    <path
      d="M36 108 C58 112 82 112 100 126 C118 112 142 112 164 108 C162 148 134 166 100 166 C66 166 38 148 36 108 Z"
      fill="#fffaf3"
    />
  ),
  nose: <ellipse cx={100} cy={122} rx={6} ry={4.5} fill={INK} />,
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 100, scale: 44 / 48 },
    neck: { x: 100, y: 148 },
  },
};

const tron: CharacterSpec = {
  fill: "#fdfdfd",
  limb: "#2e2a3a",
  forehead: "#fdfdfd",
  eyes: "panda",
  eyeX: [78, 122],
  eyeY: 103,
  mouthY: 128,
  blush: "#f7a8b8",
  blushX: [58, 142],
  blushY: 128,
  paws: true,
  back: () => (
    <>
      <circle cx={58} cy={48} r={17} fill="#2e2a3a" strokeWidth={5} {...stroke} />
      <circle cx={142} cy={48} r={17} fill="#2e2a3a" strokeWidth={5} {...stroke} />
    </>
  ),
  front: (
    <>
      <ellipse cx={76} cy={104} rx={15} ry={11.5} transform="rotate(-28 76 104)" fill="#2e2a3a" />
      <ellipse cx={124} cy={104} rx={15} ry={11.5} transform="rotate(28 124 104)" fill="#2e2a3a" />
    </>
  ),
  nose: (
    <path
      d="M94 117 C94 113 106 113 106 117 C106 121 102 123 100 123 C98 123 94 121 94 117 Z"
      fill={INK}
    />
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 103, scale: 44 / 48 },
    neck: { x: 100, y: 146 },
  },
};

// ---------- 6 bạn đồng hành mở khoá bằng thành tích (CR-024, gacha-pets-unlocks.md mục 3.2) ----------

/** Pin · cánh cụt: mũ xanh thép, mặt nạ trắng hình tim, mỏ và chân màng cam, vây hai bên. */
const pin: CharacterSpec = {
  fill: "#4f7491",
  limb: "#4f7491",
  forehead: "#fbfbfd",
  eyes: "dark",
  eyeX: [78, 122],
  eyeY: 104,
  mouthY: 125,
  blush: "#f7a8b8",
  blushX: [64, 136],
  blushY: 124,
  paws: false,
  beak: true,
  back: () => (
    <path
      d="M58 186 C58 178 74 176 86 181 C92 184 91 192 84 194 C74 197 60 195 58 186 Z M142 186 C142 178 126 176 114 181 C108 184 109 192 116 194 C126 197 140 195 142 186 Z"
      fill="#f2a541"
      strokeWidth={5}
      {...stroke}
    />
  ),
  patches: (
    <path
      d="M100 86 C93 74 66 70 55 88 C47 102 49 122 58 136 C51 150 52 168 64 177 C78 185 122 185 136 177 C148 168 149 150 142 136 C151 122 153 102 145 88 C134 70 107 74 100 86 Z"
      fill="#fbfbfd"
    />
  ),
  front: (
    <path
      d="M38 108 C22 118 18 144 30 158 C40 150 46 128 38 108 Z M162 108 C178 118 182 144 170 158 C160 150 154 128 162 108 Z"
      fill="#3c5d78"
      strokeWidth={5}
      {...stroke}
    />
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 104, scale: 44 / 48 },
    neck: { x: 100, y: 142 },
  },
};

/** Ộp · ếch: xanh lá, hai mắt lồi trên đỉnh đầu, miệng rộng, đốm sẫm, bụng vàng chanh. */
const op: CharacterSpec = {
  fill: "#45a356",
  limb: "#45a356",
  // Mi mắt xanh khép xuống lòng trắng khi tức giận
  forehead: "#45a356",
  eyes: "bead",
  eyeX: [68, 132],
  eyeY: 58,
  mouthY: 112,
  blush: "#f7a8b8",
  blushX: [54, 146],
  blushY: 98,
  paws: true,
  back: () => null,
  patches: (
    <>
      <path
        d="M100 126 C126 126 144 144 142 162 C140 178 122 184 100 184 C78 184 60 178 58 162 C56 144 74 126 100 126 Z"
        fill="#d7efa8"
      />
      <g fill="#33874a">
        <circle cx={44} cy={126} r={6} />
        <circle cx={155} cy={116} r={7} />
        <circle cx={154} cy={140} r={4.5} />
        <circle cx={52} cy={146} r={4} />
      </g>
    </>
  ),
  front: (
    <>
      <g fill="#45a356" strokeWidth={5} {...stroke}>
        <circle cx={68} cy={56} r={24} />
        <circle cx={132} cy={56} r={24} />
      </g>
      <circle cx={68} cy={57} r={16} fill="#fff" />
      <circle cx={132} cy={57} r={16} fill="#fff" />
    </>
  ),
  nose: (
    <>
      <ellipse cx={93} cy={90} rx={2.6} ry={2} fill={INK} />
      <ellipse cx={107} cy={90} rx={2.6} ry={2} fill={INK} />
    </>
  ),
  idleMouth: <path d="M70 104 C84 118 116 118 130 104" fill="none" strokeWidth={4} {...stroke} />,
  anchors: {
    // Giữa hai mắt lồi, thu nhỏ để món đầu không đè kín mắt
    head: { x: 100, y: 38, scale: 0.85 },
    face: { x: 100, y: 58, scale: 64 / 48 },
    neck: { x: 100, y: 136 },
  },
};

/** Thông · cú: nâu hạt dẻ, đĩa mặt kem quanh mắt hổ phách, chỏm tai lông, mỏ cam, cánh. */
const thong: CharacterSpec = {
  fill: "#9a6a48",
  limb: "#9a6a48",
  forehead: "#f8e6c8",
  eyes: "amber",
  eyeX: [74, 126],
  eyeY: 98,
  mouthY: 125,
  blush: "#f4a3b4",
  blushX: [56, 144],
  blushY: 126,
  paws: false,
  beak: true,
  back: () => (
    <path
      d="M80 182 L74 193 M80 182 L80 195 M80 182 L86 193 M120 182 L114 193 M120 182 L120 195 M120 182 L126 193"
      stroke="#f2a541"
      strokeWidth={5}
      strokeLinecap="round"
    />
  ),
  patches: (
    <>
      <path
        d="M100 128 C124 128 142 146 140 164 C138 178 120 184 100 184 C80 184 62 178 60 164 C58 146 76 128 100 128 Z"
        fill="#e8c9a0"
      />
      <circle cx={74} cy={98} r={26} fill="#f8e6c8" />
      <circle cx={126} cy={98} r={26} fill="#f8e6c8" />
    </>
  ),
  front: (
    <>
      <path
        d="M58 58 C50 46 44 32 42 18 C56 24 70 34 80 44 Z M142 58 C150 46 156 32 158 18 C144 24 130 34 120 44 Z"
        fill="#74492f"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M36 106 C22 120 22 148 38 160 C46 148 48 124 36 106 Z M164 106 C178 120 178 148 162 160 C154 148 152 124 164 106 Z"
        fill="#74492f"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M84 152 C88 158 94 158 98 152 M102 152 C106 158 112 158 116 152 M93 166 C97 172 103 172 107 166"
        fill="none"
        strokeWidth={3}
        opacity={0.45}
        {...stroke}
      />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 98, scale: 52 / 48 },
    neck: { x: 100, y: 142 },
  },
};

/**
 * Gai · nhím: mặt kem đào, vòng gai nâu ca-cao quanh lưng và hai bên, mái gai răng cưa phủ trán,
 * tai tròn nhỏ, mõm sáng với mũi nút đen.
 */
const gai: CharacterSpec = {
  fill: "#f9dcc0",
  limb: "#e2a983",
  forehead: "#f9dcc0",
  eyes: "bead",
  eyeX: [78, 122],
  eyeY: 106,
  mouthY: 132,
  blush: "#f49aa8",
  blushX: [60, 140],
  blushY: 124,
  paws: true,
  back: () => (
    <path
      d="M50.3 146.7 L16.3 150.9 L42 128 L8.4 120.8 L40.2 107.5 L10.6 89.7 L44.9 87.5 L22.6 61.1 L55.6 70.3 L43.2 38.1 L71.3 57.6 L69.9 23.2 L90.1 50.9 L100 18 L109.9 50.9 L130.1 23.2 L128.7 57.6 L156.8 38.1 L144.4 70.3 L177.4 61.1 L155.1 87.5 L189.4 89.7 L159.8 107.5 L191.6 120.8 L158 128 L183.7 150.9 L149.7 146.7 L120 160 L80 160 Z"
      fill="#7a5a52"
      strokeWidth={5}
      {...stroke}
    />
  ),
  patches: (
    <>
      <path
        d="M34 82 C40.5 53.5 63.3 34 100 34 C136.7 34 159.5 53.5 166 82 L153 68 L142 84 L132 64 L121 82 L111 62 L100 80 L89 62 L79 82 L68 64 L58 84 L47 68 Z"
        fill="#7a5a52"
      />
      <path
        d="M100 110 C114 110 123 118 123 126 C123 135 113 141 100 141 C87 141 77 135 77 126 C77 118 86 110 100 110 Z"
        fill="#fff3e6"
      />
    </>
  ),
  front: (
    <>
      <path
        d="M60 58 L68 47 M84 50 L89 39 M116 50 L111 39 M140 58 L132 47"
        stroke="#b08c7c"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <g strokeWidth={4.5} {...stroke}>
        <circle cx={40} cy={84} r={11} fill="#e9b48f" />
        <circle cx={160} cy={84} r={11} fill="#e9b48f" />
      </g>
      <circle cx={41} cy={85} r={5} fill="#f49aa8" />
      <circle cx={159} cy={85} r={5} fill="#f49aa8" />
    </>
  ),
  nose: (
    <>
      <ellipse cx={100} cy={117} rx={7.5} ry={5.5} fill={INK} />
      <ellipse cx={97.5} cy={115} rx={2.2} ry={1.4} fill="#fff" />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 107, scale: 44 / 48 },
    neck: { x: 100, y: 148 },
  },
};

/** Mây · koala: xám mây, tai tròn to có lông trắng hình đám mây, mũi đen to hình hạt đậu. */
const may: CharacterSpec = {
  fill: "#bcc1ca",
  limb: "#9da3b0",
  forehead: "#bcc1ca",
  eyes: "bead",
  eyeX: [72, 128],
  eyeY: 100,
  mouthY: 140,
  blush: "#f7a8b8",
  blushX: [56, 144],
  blushY: 122,
  paws: true,
  back: () => null,
  patches: (
    <path
      d="M100 148 C120 148 136 157 137 168 C138 180 120 184 100 184 C80 184 62 180 63 168 C64 157 80 148 100 148 Z"
      fill="#eceef3"
    />
  ),
  front: (
    <>
      <g fill="#bcc1ca" strokeWidth={5} {...stroke}>
        <circle cx={44} cy={60} r={26} />
        <circle cx={156} cy={60} r={26} />
      </g>
      <path
        d="M30 70 C23 70 21 61 28 58 C27 50 36 47 40 52 C43 45 53 46 54 53 C60 53 62 61 57 64 C60 69 55 73 51 71 C47 76 36 75 30 70 Z M170 70 C177 70 179 61 172 58 C173 50 164 47 160 52 C157 45 147 46 146 53 C140 53 138 61 143 64 C140 69 145 73 149 71 C153 76 164 75 170 70 Z"
        fill="#fbfbfd"
      />
    </>
  ),
  nose: (
    <>
      <path
        d="M100 102 C110 102 115 109 115 118 C115 128 108 133 100 133 C92 133 85 128 85 118 C85 109 90 102 100 102 Z"
        fill="#3b3650"
        strokeWidth={3}
        {...stroke}
      />
      <ellipse cx={94} cy={110} rx={3.2} ry={2.2} fill="#fff" opacity={0.75} />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 100, scale: 56 / 48 },
    neck: { x: 100, y: 152 },
  },
};

/**
 * Lửa · rồng con (thú hiếm nhất): tím, sừng vàng, cánh dơi nhỏ, mõm sáng có răng nanh, bụng
 * vàng có vạch, đuôi có ngọn lửa. Cánh vỗ và lửa lập loè khi `animated`.
 */
const lua: CharacterSpec = {
  fill: "#9566e2",
  limb: "#9566e2",
  forehead: "#9566e2",
  eyes: "dark",
  eyeX: [76, 124],
  eyeY: 100,
  mouthY: 129,
  blush: "#ff9ec4",
  blushX: [58, 142],
  blushY: 120,
  paws: true,
  back: (animated) => (
    <>
      <g className={animated ? "fx-flap-l" : undefined}>
        <path
          d="M46 88 C34 72 20 60 6 56 C10 66 10 76 12 84 C18 82 24 84 26 90 C32 88 38 92 38 98 C42 98 46 104 46 112 Z"
          fill="#c9b6fb"
          strokeWidth={5}
          {...stroke}
        />
      </g>
      <g className={animated ? "fx-flap-r" : undefined}>
        <path
          d="M154 88 C166 72 180 60 194 56 C190 66 190 76 188 84 C182 82 176 84 174 90 C168 88 162 92 162 98 C158 98 154 104 154 112 Z"
          fill="#c9b6fb"
          strokeWidth={5}
          {...stroke}
        />
      </g>
      <g className={animated ? "fx-wag" : undefined}>
        <path
          d="M144 168 C176 170 192 148 186 122 C184 114 174 114 175 124 C178 142 166 152 142 152 Z"
          fill="#9566e2"
          strokeWidth={6}
          {...stroke}
        />
        <g className={animated ? "fx-flicker" : undefined}>
          <path
            d="M181 120 C169 117 168 102 177 91 C178 99 183 100 184 93 C195 101 195 117 181 120 Z"
            fill="#ff8a3d"
            strokeWidth={4}
            {...stroke}
          />
          <path
            d="M181 115 C176 113 176 106 179 102 C181 106 184 107 185 104 C188 109 187 114 181 115 Z"
            fill="#ffd166"
          />
        </g>
      </g>
    </>
  ),
  patches: (
    <>
      <path
        d="M100 142 C120 142 136 151 138 164 C139 178 122 184 100 184 C78 184 61 178 62 164 C64 151 80 142 100 142 Z"
        fill="#ffe08a"
      />
      <path
        d="M100 108 C118 108 130 116 130 126 C130 137 116 142 100 142 C84 142 70 137 70 126 C70 116 82 108 100 108 Z"
        fill="#bb9df3"
      />
    </>
  ),
  front: (
    <>
      <path
        d="M66 50 C58 38 58 22 66 12 C70 24 78 32 86 40 Z M134 50 C142 38 142 22 134 12 C130 24 122 32 114 40 Z"
        fill="#ffd166"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M72 156 C90 161 110 161 128 156 M74 169 C90 174 110 174 126 169"
        fill="none"
        stroke="#e0a93a"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  ),
  nose: (
    <>
      <ellipse cx={93} cy={117} rx={2.6} ry={2} fill={INK} />
      <ellipse cx={107} cy={117} rx={2.6} ry={2} fill={INK} />
    </>
  ),
  idleMouth: (
    <>
      <path
        d="M91 129 C93 134 98 134 100 130 C102 134 107 134 109 129"
        fill="none"
        strokeWidth={3.5}
        {...stroke}
      />
      <path d="M102.5 132.6 L104.6 137.5 L106.6 132 Z" fill="#fff" strokeWidth={2} {...stroke} />
    </>
  ),
  anchors: {
    head: { x: 100, y: 40 },
    face: { x: 100, y: 100, scale: 1 },
    neck: { x: 100, y: 146 },
  },
};

export const CHARACTER_SPECS: Record<CharacterId, CharacterSpec> = {
  khoi,
  bo,
  mochi,
  bap,
  cam,
  tron,
  pin,
  op,
  thong,
  gai,
  may,
  lua,
};
