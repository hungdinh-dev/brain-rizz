import type { CharacterId } from "@brain-rizz/shared";
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
  /** Mảng lông vẽ đè lên màu thân, dưới viền */
  patches?: ReactNode;
  /** Phía trước viền: tai trước, cánh, chỏm lông, ria, quầng mắt */
  front?: ReactNode;
  nose?: ReactNode;
  /** Miệng lúc bình thường, mặc định là chữ ω */
  idleMouth?: ReactNode;
  /** Đạo cụ lúc bình thường (cà rốt của Mochi) */
  idleProp?: ReactNode;
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
};

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
      <path
        d="M70 52 C58 30 56 8 68 4 C80 0 86 24 86 48 Z M130 52 C142 30 144 8 132 4 C120 0 114 24 114 48 Z"
        fill="#fdfaf6"
        strokeWidth={5}
        {...stroke}
      />
      <path
        d="M72 44 C65 30 64 14 69 10 C75 9 79 26 79 44 Z M128 44 C135 30 136 14 131 10 C125 9 121 26 121 44 Z"
        fill="#f7a8b8"
      />
      <circle cx={160} cy={166} r={12} fill="#fdfaf6" strokeWidth={5} {...stroke} />
    </>
  ),
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
};

export const CHARACTER_SPECS: Record<CharacterId, CharacterSpec> = {
  khoi,
  bo,
  mochi,
  bap,
  cam,
  tron,
};
