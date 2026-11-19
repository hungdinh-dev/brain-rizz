import type { CosmeticId, CosmeticSlot } from "@brain-rizz/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Anchor, INK } from "./specs";

/**
 * 24 phụ kiện gacha (CR-023, docs/01-product/gacha-pets-unlocks.md mục 3.1 và 5.5), vẽ một lần bằng
 * SVG rồi đặt lên mọi loài theo điểm neo `CharacterSpec.anchors`. Cùng nét với nhân vật: viền mực
 * `INK` 4–4,5 (chi tiết 2,5–3,5), màu đặc kiểu nhãn dán, không gradient, không id (nhiều nhân vật
 * trên một trang không đụng nhau).
 *
 * Hệ toạ độ chuẩn hoá quanh gốc (0, 0), đơn vị như khung 200×200 của `Character`:
 * - **Đầu** (`head`): (0, 0) = điểm neo đầu = đáy món. Thân chuẩn (`BODY_PATH`) có vòm đầu cao hơn
 *   gốc 6 ở giữa, ngang gốc ở x = ±30, thấp hơn gốc 13 ở x = ±50. Món "đội" (vương miện, mũ phù
 *   thuỷ…) đáy ở y ≈ 0; món "trùm" (mũ len, mũ lưỡi trai) phủ xuống tới y ≈ +12…+16 ở hai bên;
 *   tai nghe ôm hai bên đầu tới y ≈ +70; hào quang lơ lửng phía trên (y −40…−20).
 * - **Mặt** (`face`): (0, 0) = điểm giữa hai mắt, hai mắt ở (±24, 0) (khoảng cách chuẩn 48; loài
 *   khác cỡ đặt `scale` ở neo). Kính có tròng trong → vẫn thấy mắt và biểu cảm; kính râm che mắt.
 * - **Cổ** (`neck`): (0, 0) = tâm cổ, ngay dưới miệng. Thân rộng ±61 ở đó; khăn/vòng ôm theo đường
 *   cong võng xuống giữa (giữa thấp hơn hai đầu ~10–15). Áo choàng (`layer: "back"`) vẽ sau thân,
 *   vạt dưới lộ ra dưới đáy thân (y +42…+62); phần cổ áo + móc cài nằm ở `front()`.
 *
 * Thứ tự lớp trong `Character`: món "back" → thân → cổ → mặt → đầu → tay, đạo cụ, hiệu ứng.
 */

export type AccessorySlot = CosmeticSlot;
export type AccessoryLayer = "back" | "front";

export interface AccessoryArt {
  slot: AccessorySlot;
  /** `back`: vẽ trước thân (sau lưng). `front`: đè lên thân theo thứ tự cổ → mặt → đầu */
  layer: AccessoryLayer;
  /** Hình món quanh gốc (0, 0). `animated`: lấp lánh/lơ lửng (tự tắt khi giảm chuyển động) */
  render(animated?: boolean): ReactNode;
  /** Chỉ món `layer: "back"`: phần nằm trước thân (cổ áo, móc cài), vẽ ở lớp của chỗ đeo */
  front?(animated?: boolean): ReactNode;
  /** Khung bao `[x, y, rộng, cao]` quanh gốc, đã gồm viền — dùng cho ảnh nhỏ `AccessoryIcon` */
  box: readonly [number, number, number, number];
  /**
   * Chỉ món đầu. Mặc định loài tai dài (`CharacterSpec.ears`) có tai vẽ đè lên món đầu; món nhỏ
   * cài tóc (nơ) thì ngược lại, vẽ trước tai cho trọn hình — loài đó tự dời món vào giữa hai tai
   * bằng `anchors.headItems`.
   */
  frontOfEars?: boolean;
}

// ---------- Bảng màu (cùng họ màu thương hiệu, globals.css) ----------

const C = {
  paper: "#fff8ef",
  white: "#ffffff",
  sun: "#ffd166",
  sunDeep: "#f2a541",
  pink: "#f7a8b8",
  rose: "#f27d93",
  red: "#e85d75",
  redDeep: "#c94860",
  sky: "#8ec5ff",
  blue: "#4d9de0",
  blueDeep: "#3a7cc0",
  grape: "#7768ae",
  grapeDeep: "#5d4f94",
  night: "#2e2a52",
  nightLight: "#3a3560",
  mint: "#7fd1ae",
  green: "#3bb273",
  leather: "#b9733f",
  leatherLight: "#c98a4f",
  leatherDeep: "#8a5a2e",
  brown: "#5a3a2e",
  skin: "#f6c89f",
  skinDeep: "#e8a87c",
  crimson: "#b8324f",
  pearl: "#fbf4ff",
  orchid: "#ff8fe9",
} as const;

const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;

// ---------- Hình phụ trợ ----------

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ngôi sao 4 cánh lấp lánh (cùng công thức với Character), tâm (cx, cy), bán kính s. */
function sparklePath(cx: number, cy: number, s: number) {
  const k = s * 0.1;
  const m = s * 0.3;
  return `M${cx} ${cy - s} C${cx + k} ${cy - m} ${cx + m} ${cy - k} ${cx + s} ${cy} C${cx + m} ${cy + k} ${cx + k} ${cy + m} ${cx} ${cy + s} C${cx - k} ${cy + m} ${cx - m} ${cy + k} ${cx - s} ${cy} C${cx - m} ${cy - k} ${cx - k} ${cy - m} ${cx} ${cy - s} Z`;
}

function Sparkles({
  points,
  animated,
}: {
  points: readonly (readonly [number, number, number])[];
  animated?: boolean;
}) {
  return (
    <>
      {points.map(([x, y, s], i) => (
        <path
          key={`${x},${y}`}
          className={animated ? "fx fx-sparkle" : undefined}
          style={animated && i ? { animationDelay: `${-0.45 * i}s` } : undefined}
          d={sparklePath(x, y, s)}
          fill={C.sun}
          strokeWidth={2.2}
          {...line}
        />
      ))}
    </>
  );
}

/** Sao 5 cánh tâm (cx, cy): bán kính ngoài R, trong r. */
function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + 36 * k) * Math.PI) / 180;
    const rad = k % 2 ? r : R;
    pts.push(`${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Hoa 5 cánh liền một nét (5 cung tròn), tâm (cx, cy), bán kính ngoài ≈ r. */
function flowerPath(cx: number, cy: number, r: number) {
  const petal = r * 0.5;
  const notch = r * 0.84; // giao điểm ngoài của hai cánh kề nhau
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${r1(cx + notch * Math.cos(a))} ${r1(cy + notch * Math.sin(a))}`;
  };
  let d = `M${at(-126)}`;
  for (let k = 0; k < 5; k++) d += ` A${r1(petal)} ${r1(petal)} 0 1 1 ${at(-54 + 72 * k)}`;
  return `${d} Z`;
}

function Flower({
  x,
  y,
  r,
  fill,
  center,
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
  center: string;
}) {
  return (
    <>
      <path d={flowerPath(x, y, r)} fill={fill} strokeWidth={2.4} {...line} />
      <circle cx={x} cy={y} r={r1(r * 0.34)} fill={center} stroke={INK} strokeWidth={1.8} />
    </>
  );
}

function Leaf({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={7}
      ry={3.4}
      transform={`rotate(${rotate} ${x} ${y})`}
      fill={C.green}
      stroke={INK}
      strokeWidth={2.2}
    />
  );
}

/** Kính tròng trong: phản chiếu nhỏ góc trên trái mỗi tròng. */
function Glint({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 9} ${y - 5} C${x - 7} ${y - 9} ${x - 3} ${y - 11} ${x + 1} ${y - 11}`}
      fill="none"
      stroke={C.white}
      strokeWidth={2.5}
      strokeLinecap="round"
      opacity={0.9}
    />
  );
}

/** Đường cong võng của khăn/vòng cổ: y tại x khi hai đầu ở `end`, giữa ở `mid`. */
const sag = (x: number, half: number, end: number, mid: number) =>
  r1(end + (mid - end) * (1 - (x / half) ** 2));

// ---------- Đầu ----------

const beanie: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-53, -65, 106, 79],
  render: () => (
    <>
      <path
        d="M-44 0 C-47 -30 -26 -48 0 -48 C26 -48 47 -30 44 0 Z"
        fill={C.red}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-20 -42 C-25 -28 -25 -14 -22 -2 M0 -47 L0 -2 M20 -42 C25 -28 25 -14 22 -2"
        fill="none"
        stroke={C.redDeep}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={0} cy={-52} r={10} fill={C.paper} strokeWidth={4.5} {...line} />
      <path
        d="M-4 -55 L-1 -52 M3 -56 L5 -53 M-3 -48 L0 -46"
        stroke="#d9cdbf"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M-49 -4 C-30 -11 30 -11 49 -4 L50 12 C30 5 -30 5 -50 12 Z"
        fill={C.rose}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-40 -5 L-40 8 M-30 -7 L-30 6 M-20 -8 L-20 5 M-10 -9 L-10 5 M0 -9 L0 5 M10 -9 L10 5 M20 -8 L20 5 M30 -7 L30 6 M40 -5 L40 8"
        stroke={C.redDeep}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.7}
      />
    </>
  ),
};

const bow: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-8, -29, 64, 50],
  frontOfEars: true,
  render: () => (
    <g transform="translate(26 -8) rotate(16)">
      <path
        d="M-3 3 L-12 19 L-4 17 Z M3 3 L12 19 L4 17 Z"
        fill={C.red}
        strokeWidth={3.5}
        {...line}
      />
      <path
        d="M0 0 C-8 -13 -27 -17 -27 -2 C-27 11 -9 8 0 0 Z M0 0 C8 -13 27 -17 27 -2 C27 11 9 8 0 0 Z"
        fill={C.rose}
        strokeWidth={4}
        {...line}
      />
      <path
        d="M-8 -2 C-14 -6 -19 -6 -21 -3 M8 -2 C14 -6 19 -6 21 -3"
        fill="none"
        stroke={C.redDeep}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <ellipse cx={0} cy={0} rx={6} ry={7} fill={C.red} strokeWidth={3.5} {...line} />
    </g>
  ),
};

const cap: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-51, -52, 102, 71],
  render: () => (
    <>
      <path
        d="M-42 2 C-44 -28 -24 -44 0 -44 C24 -44 44 -28 42 2 Z"
        fill={C.blue}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M0 -43 L0 -30 M-22 -39 C-28 -24 -28 -10 -26 0 M22 -39 C28 -24 28 -10 26 0"
        fill="none"
        stroke={C.blueDeep}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={0} cy={-45} r={4.5} fill={C.blueDeep} strokeWidth={3} {...line} />
      <circle cx={0} cy={-19} r={8.5} fill={C.paper} strokeWidth={3} {...line} />
      <path d="M-4 -19 L0 -24 L4 -19 L0 -14 Z" fill={C.red} />
      <path
        d="M-48 -2 C-30 -8 30 -8 48 -2 C46 10 28 16 0 16 C-28 16 -46 10 -48 -2 Z"
        fill={C.blueDeep}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-36 3 C-20 0 20 0 36 3"
        fill="none"
        stroke={C.paper}
        strokeWidth={2}
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity={0.75}
      />
    </>
  ),
};

const flowerCrown: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-62, -6, 124, 33],
  render: () => (
    <>
      <path
        d="M-50 6 C-30 16 30 16 50 6"
        fill="none"
        stroke={INK}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path
        d="M-50 6 C-30 16 30 16 50 6"
        fill="none"
        stroke={C.green}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Leaf x={-53} y={4} rotate={-55} />
      <Leaf x={53} y={4} rotate={55} />
      <Leaf x={-32} y={5} rotate={-30} />
      <Leaf x={32} y={5} rotate={30} />
      <Leaf x={-11} y={7} rotate={-15} />
      <Leaf x={11} y={7} rotate={15} />
      <Flower x={-43} y={8.7} r={9} fill={C.pink} center={C.sunDeep} />
      <Flower x={-21} y={12.4} r={9.5} fill={C.sun} center={C.red} />
      <Flower x={0} y={13.5} r={10} fill={C.paper} center={C.sunDeep} />
      <Flower x={21} y={12.4} r={9.5} fill={C.sun} center={C.red} />
      <Flower x={43} y={8.7} r={9} fill={C.pink} center={C.sunDeep} />
    </>
  ),
};

const witchHat: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-63, -92, 126, 107],
  render: () => (
    <>
      <ellipse cx={0} cy={2} rx={60} ry={11} fill={C.grapeDeep} strokeWidth={4.5} {...line} />
      <path
        d="M-32 0 L-8 -70 C-4 -82 8 -92 24 -88 C31 -86 32 -78 25 -77 C15 -76 10 -70 8 -64 L30 0 C14 5 -16 5 -32 0 Z"
        fill={C.grape}
        strokeWidth={4.5}
        {...line}
      />
      <path d="M-4 -46 C-11 -40 -9 -30 -1 -28 C-7 -32 -8 -40 -4 -46 Z" fill={C.sun} />
      <path
        d="M-29 -9 C-14 -4 14 -4 27 -9 L30 0 C14 5 -16 5 -32 0 Z"
        fill={C.sun}
        strokeWidth={3.5}
        {...line}
      />
      <rect x={-6} y={-7.5} width={12} height={9} rx={2} fill="none" stroke={INK} strokeWidth={3} />
    </>
  ),
};

const gradCap: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-59, -37, 118, 68],
  render: () => (
    <>
      <path
        d="M-36 6 C-38 -10 -20 -18 0 -18 C20 -18 38 -10 36 6 C24 12 -24 12 -36 6 Z"
        fill={C.night}
        strokeWidth={4.5}
        {...line}
      />
      <path d="M0 -34 L56 -18 L0 -2 L-56 -18 Z" fill={C.nightLight} strokeWidth={4.5} {...line} />
      <path
        d="M-44 -18 L0 -30 L44 -18"
        fill="none"
        stroke="#57518a"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M0 -18 C18 -18 34 -16 42 -14 L42 12"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 -18 C18 -18 34 -16 42 -14 L42 12"
        fill="none"
        stroke={C.sun}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={0} cy={-18} r={4.5} fill={C.sun} strokeWidth={3} {...line} />
      <path d="M37 10 L47 10 L50 28 L34 28 Z" fill={C.sun} strokeWidth={3} {...line} />
      <path
        d="M38.5 16 L37.5 26 M42 16 L42 26 M45.5 16 L46.5 26"
        stroke={C.sunDeep}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
};

const headphones: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-79, -19, 158, 92],
  render: () => (
    <>
      <path
        d="M-62 42 C-66 -4 -34 -12 0 -12 C34 -12 66 -4 62 42"
        fill="none"
        stroke={INK}
        strokeWidth={13}
        strokeLinecap="round"
      />
      <path
        d="M-62 42 C-66 -4 -34 -12 0 -12 C34 -12 66 -4 62 42"
        fill="none"
        stroke={C.mint}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      <rect
        x={-76}
        y={30}
        width={24}
        height={40}
        rx={11}
        fill={C.mint}
        strokeWidth={4.5}
        {...line}
      />
      <rect
        x={52}
        y={30}
        width={24}
        height={40}
        rx={11}
        fill={C.mint}
        strokeWidth={4.5}
        {...line}
      />
      <circle cx={-64} cy={50} r={5.5} fill={C.paper} stroke={INK} strokeWidth={2.5} />
      <circle cx={64} cy={50} r={5.5} fill={C.paper} stroke={INK} strokeWidth={2.5} />
    </>
  ),
};

const crown: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-48, -53, 96, 58],
  render: () => (
    <>
      <path
        d="M-36 0 L-42 -30 L-28 -16 L-20 -42 L-10 -18 L0 -46 L10 -18 L20 -42 L28 -16 L42 -30 L36 0 C22 4 -22 4 -36 0 Z"
        fill={C.sun}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-38 -10 C-22 -5 22 -5 38 -10 L36 0 C22 4 -22 4 -36 0 Z"
        fill={C.sunDeep}
        strokeWidth={3.5}
        {...line}
      />
      <path
        d="M-31 -14 L-29 -20"
        stroke={C.white}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle cx={-20} cy={-3.5} r={3.5} fill={C.red} stroke={INK} strokeWidth={2.4} />
      <circle cx={0} cy={-2.5} r={4.5} fill={C.blue} stroke={INK} strokeWidth={2.4} />
      <circle cx={20} cy={-3.5} r={3.5} fill={C.green} stroke={INK} strokeWidth={2.4} />
      {(
        [
          [-42, -30, 4],
          [-20, -42, 4],
          [0, -46, 5],
          [20, -42, 4],
          [42, -30, 4],
        ] as const
      ).map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill={C.paper} stroke={INK} strokeWidth={3} />
      ))}
    </>
  ),
};

const cowboy: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-71, -47, 142, 66],
  render: () => (
    <>
      <path
        d="M-30 0 C-34 -22 -28 -42 -14 -44 C-6 -45 -3 -37 0 -37 C3 -37 6 -45 14 -44 C28 -42 34 -22 30 0 Z"
        fill={C.leatherLight}
        strokeWidth={4.5}
        {...line}
      />
      <path d="M0 -37 L0 -24" stroke={C.leatherDeep} strokeWidth={3} strokeLinecap="round" />
      <path
        d="M-31 -10 C-16 -6 16 -6 31 -10 L30 0 C16 4 -16 4 -30 0 Z"
        fill={C.brown}
        strokeWidth={3.5}
        {...line}
      />
      <rect
        x={-5}
        y={-8}
        width={10}
        height={8}
        rx={2}
        fill={C.sun}
        stroke={INK}
        strokeWidth={2.4}
      />
      <path
        d="M-68 -12 C-62 6 -38 16 0 16 C38 16 62 6 68 -12 C60 -4 42 2 0 2 C-42 2 -60 -4 -68 -12 Z"
        fill={C.leather}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-56 -2 C-40 9 40 9 56 -2"
        fill="none"
        stroke={C.leatherDeep}
        strokeWidth={2.5}
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
    </>
  ),
};

const halo: AccessoryArt = {
  slot: "head",
  layer: "front",
  box: [-57, -57, 114, 42],
  render: (animated) => (
    <>
      <g className={animated ? "fx fx-halo" : undefined}>
        <ellipse
          cx={0}
          cy={-30}
          rx={36}
          ry={10}
          fill="none"
          stroke={C.sun}
          strokeWidth={20}
          opacity={0.3}
        />
        <ellipse cx={0} cy={-30} rx={34} ry={9} fill="none" stroke={INK} strokeWidth={11} />
        <ellipse cx={0} cy={-30} rx={34} ry={9} fill="none" stroke={C.sun} strokeWidth={5.5} />
        <path
          d="M-20 -37 C-8 -40 8 -40 20 -37"
          fill="none"
          stroke="#fffbe8"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </g>
      <Sparkles
        animated={animated}
        points={[
          [-47, -42, 7],
          [48, -24, 6],
          [31, -50, 4.5],
        ]}
      />
    </>
  ),
};

// ---------- Mặt ----------

const roundGlasses: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-61, -19, 122, 38],
  render: () => (
    <>
      <path d="M-40 -3 L-58 -8 M40 -3 L58 -8" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <circle
        cx={-24}
        cy={0}
        r={16}
        fill={C.white}
        fillOpacity={0.28}
        stroke={INK}
        strokeWidth={4.5}
      />
      <circle
        cx={24}
        cy={0}
        r={16}
        fill={C.white}
        fillOpacity={0.28}
        stroke={INK}
        strokeWidth={4.5}
      />
      <path
        d="M-8 -3 C-4 -8 4 -8 8 -3"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Glint x={-24} y={0} />
      <Glint x={24} y={0} />
    </>
  ),
};

const sunglasses: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-63, -15, 126, 33],
  render: () => (
    <>
      <path
        d="M-48 -9 L-60 -12 M48 -9 L60 -12"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M-46 -9 L-5 -9 C-5 7 -13 16 -26 16 C-39 16 -46 7 -46 -9 Z M46 -9 L5 -9 C5 7 13 16 26 16 C39 16 46 7 46 -9 Z"
        fill="#2a2540"
        strokeWidth={4}
        {...line}
      />
      <path d="M-49 -10 L49 -10" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M-38 -2 L-32 -6 M-37 6 L-26 -2 M14 -2 L20 -6 M15 6 L26 -2"
        stroke={C.white}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.6}
      />
    </>
  ),
};

const bandage: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-58, 7, 40, 30],
  render: () => (
    <g transform="translate(-38 22) rotate(-24)">
      <rect
        x={-17}
        y={-6.5}
        width={34}
        height={13}
        rx={6.5}
        fill={C.skin}
        stroke={INK}
        strokeWidth={3}
      />
      <rect x={-6} y={-4.5} width={12} height={9} rx={1.5} fill={C.skinDeep} />
      <path
        d="M-12 -2 L-12 -2 M-12 2 L-12 2 M12 -2 L12 -2 M12 2 L12 2"
        stroke="#c98676"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  ),
};

function heartPath(cx: number) {
  return `M${cx} 13 C${cx - 22} 1 ${cx - 21} -17 ${cx - 9} -17 C${cx - 4} -17 ${cx} -13 ${cx} -9 C${cx} -13 ${cx + 4} -17 ${cx + 9} -17 C${cx + 21} -17 ${cx + 22} 1 ${cx} 13 Z`;
}

const heartGlasses: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-61, -20, 122, 36],
  render: () => (
    <>
      <path
        d="M-42 -6 L-58 -10 M42 -6 L58 -10"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d={`${heartPath(-25)} ${heartPath(25)}`}
        fill={C.red}
        fillOpacity={0.85}
        strokeWidth={4}
        {...line}
      />
      <path
        d="M-7 -6 C-3 -10 3 -10 7 -6"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M-39 -8 C-38 -12 -35 -13 -32 -13 M11 -8 C12 -12 15 -13 18 -13"
        fill="none"
        stroke={C.white}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  ),
};

const heroMask: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-59, -20, 140, 42],
  render: () => (
    <>
      <path
        d="M54 -6 C62 -12 70 -8 78 -16 C76 -8 72 -2 64 0 C70 2 74 6 76 12 C68 8 62 6 55 4 Z"
        fill={C.redDeep}
        strokeWidth={3.5}
        {...line}
      />
      <path
        d="M-56 -4 C-52 -18 -32 -20 -16 -14 C-8 -11 8 -11 16 -14 C32 -20 52 -18 56 -4 C58 8 48 19 33 19 C21 19 12 12 0 12 C-12 12 -21 19 -33 19 C-48 19 -58 8 -56 -4 Z M-38.5 1 A13.5 12 0 1 0 -11.5 1 A13.5 12 0 1 0 -38.5 1 Z M11.5 1 A13.5 12 0 1 0 38.5 1 A13.5 12 0 1 0 11.5 1 Z"
        fill={C.red}
        fillRule="evenodd"
        strokeWidth={4}
        {...line}
      />
      <path
        d="M-48 -8 C-44 -14 -36 -15 -30 -14"
        fill="none"
        stroke={C.white}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.75}
      />
    </>
  ),
};

const monocle: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [4, -21, 45, 76],
  render: () => (
    <>
      <path
        d="M40 8 C50 22 46 38 36 48"
        fill="none"
        stroke={INK}
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <path
        d="M40 8 C50 22 46 38 36 48"
        fill="none"
        stroke={C.sun}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <circle cx={36} cy={48} r={3.5} fill={C.sun} stroke={INK} strokeWidth={2.4} />
      <circle
        cx={24}
        cy={0}
        r={17}
        fill={C.white}
        fillOpacity={0.28}
        stroke={INK}
        strokeWidth={8}
      />
      <circle cx={24} cy={0} r={17} fill="none" stroke={C.sun} strokeWidth={3.5} />
      <Glint x={24} y={0} />
    </>
  ),
};

const starGlasses: AccessoryArt = {
  slot: "face",
  layer: "front",
  box: [-62, -31, 124, 56],
  render: (animated) => {
    const stars = `${starPath(-25, 1, 21, 9.5)} ${starPath(25, 1, 21, 9.5)}`;
    return (
      <>
        <path
          d="M-42 -4 L-58 -8 M42 -4 L58 -8"
          stroke={INK}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d={stars}
          fill={C.sky}
          fillOpacity={0.6}
          stroke={INK}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        <path d={stars} fill="none" stroke={C.sun} strokeWidth={3.2} strokeLinejoin="round" />
        <path
          d="M-8 -3 C-4 -7 4 -7 8 -3"
          fill="none"
          stroke={INK}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path
          d="M-8 -3 C-4 -7 4 -7 8 -3"
          fill="none"
          stroke={C.sun}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Sparkles
          animated={animated}
          points={[
            [53, -21, 6.5],
            [-52, 17, 5],
          ]}
        />
      </>
    );
  },
};

// ---------- Cổ ----------

const scarf: AccessoryArt = {
  slot: "neck",
  layer: "front",
  box: [-65, -15, 130, 66],
  render: () => (
    <>
      <path
        d="M-62 -12 C-30 -1 30 -1 62 -12 L60 4 C30 15 -30 15 -60 4 Z"
        fill={C.blue}
        strokeWidth={4.5}
        {...line}
      />
      <path
        d="M-61 -4 C-30 7 30 7 61 -4"
        fill="none"
        stroke={C.sky}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path d="M22 4 L42 2 L46 40 L28 42 Z" fill={C.blue} strokeWidth={4.5} {...line} />
      <path
        d="M25 16 L43 14 M27 29 L45 27"
        stroke={C.sky}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d="M31 43 L31 49 M37 42.5 L37 48.5 M43 42 L43 48"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <rect
        x={20}
        y={-6}
        width={20}
        height={16}
        rx={7}
        fill={C.blueDeep}
        strokeWidth={4}
        {...line}
      />
    </>
  ),
};

const bowtie: AccessoryArt = {
  slot: "neck",
  layer: "front",
  box: [-28, -12, 56, 27],
  render: () => (
    <>
      <path
        d="M-4 2 L-22 -9 C-27 -6 -27 10 -22 13 Z M4 2 L22 -9 C27 -6 27 10 22 13 Z"
        fill={C.red}
        strokeWidth={4}
        {...line}
      />
      <circle cx={-17} cy={-1} r={1.9} fill={C.paper} />
      <circle cx={-14} cy={7} r={1.9} fill={C.paper} />
      <circle cx={17} cy={-1} r={1.9} fill={C.paper} />
      <circle cx={14} cy={7} r={1.9} fill={C.paper} />
      <rect
        x={-6}
        y={-5}
        width={12}
        height={14}
        rx={4}
        fill={C.redDeep}
        strokeWidth={3.5}
        {...line}
      />
    </>
  ),
};

const bell: AccessoryArt = {
  slot: "neck",
  layer: "front",
  box: [-63, -11, 126, 44],
  render: () => (
    <>
      <path
        d="M-60 -8 C-30 3 30 3 60 -8 L59 0 C30 11 -30 11 -59 0 Z"
        fill={C.red}
        strokeWidth={4}
        {...line}
      />
      <circle cx={0} cy={10} r={3.5} fill="none" stroke={INK} strokeWidth={3} />
      <circle cx={0} cy={20} r={11} fill={C.sun} strokeWidth={4} {...line} />
      <path
        d="M-10 17 C-4 19 4 19 10 17"
        fill="none"
        stroke={C.sunDeep}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M0 23 L0 29" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <circle cx={0} cy={23} r={3} fill={INK} />
      <path
        d="M-6 13 C-4 11 -1 10 2 10"
        fill="none"
        stroke={C.white}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  ),
};

/** Vạt áo choàng sau lưng: vai ±48, vạt dưới ±90, đáy võng tới y ≈ +60 (lộ dưới đáy thân). */
const CAPE_DRAPE = "M-48 -12 C-64 -2 -82 26 -90 50 C-58 60 58 60 90 50 C82 26 64 -2 48 -12 Z";
/** Cổ áo: dải cong ôm cổ, cùng đường cong với khăn len. */
const CAPE_COLLAR = "M-58 -9 C-30 1 30 1 58 -9 L57 -1 C30 9 -30 9 -57 -1 Z";
/** Lót trong giữa hai vạt (mặt trong áo choàng nhìn từ trước). */
const CAPE_LINING = "M-40 -6 C-50 10 -58 30 -62 50 C-30 57 30 57 62 50 C58 30 50 10 40 -6 Z";

const cape: AccessoryArt = {
  slot: "neck",
  layer: "back",
  box: [-93, -15, 186, 75],
  render: () => (
    <>
      <path d={CAPE_DRAPE} fill={C.blue} strokeWidth={5} {...line} />
      {/* Lót trong: phần lớn khuất sau thân, chỉ lộ dưới đáy thân + giúp ảnh nhỏ đọc ra "áo choàng" */}
      <path d={CAPE_LINING} fill={C.blueDeep} strokeWidth={3} {...line} />
      <path
        d="M-72 44 C-68 32 -66 20 -62 6 M72 44 C68 32 66 20 62 6 M-30 52 L-30 40 M30 52 L30 40"
        fill="none"
        stroke={C.blueDeep}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  ),
  front: () => (
    <>
      <path d={CAPE_COLLAR} fill={C.blue} strokeWidth={4} {...line} />
      <circle cx={0} cy={5} r={6.5} fill={C.sun} strokeWidth={3.5} {...line} />
      <path d="M-3 2 C-2 1 -1 0.5 1 0.5" stroke={C.white} strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
};

const LEI = [
  [C.pink, C.sunDeep],
  [C.sun, C.red],
  [C.paper, C.sunDeep],
  [C.sunDeep, C.red],
  [C.orchid, C.sun],
] as const;

const lei: AccessoryArt = {
  slot: "neck",
  layer: "front",
  box: [-60, -16, 120, 35],
  render: () => {
    const xs = [-48, -36, -24, -12, 0, 12, 24, 36, 48];
    return (
      <>
        {xs.slice(0, -1).map((x) => (
          <Leaf key={x} x={x + 6} y={sag(x + 6, 58, -8, 6) + 5} rotate={x < 0 ? 25 : -25} />
        ))}
        {xs.map((x, i) => {
          const [fill, center] = LEI[i % LEI.length] ?? LEI[0];
          return <Flower key={x} x={x} y={sag(x, 58, -8, 6)} r={8} fill={fill} center={center} />;
        })}
      </>
    );
  },
};

const pearls: AccessoryArt = {
  slot: "neck",
  layer: "front",
  box: [-58, -13, 116, 51],
  render: () => {
    const xs = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
    return (
      <>
        <path
          d="M-56 -10 C-34 12 34 12 56 -10"
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
        />
        {xs.map((x) => {
          const y = sag(x, 56, -9, 9);
          return (
            <g key={x}>
              <circle cx={x} cy={y} r={5.2} fill={C.pearl} stroke={INK} strokeWidth={2.5} />
              <circle cx={x - 1.6} cy={y - 1.6} r={1.4} fill={C.white} />
            </g>
          );
        })}
        <path
          d="M0 15 C8 23 8 33 0 36 C-8 33 -8 23 0 15 Z"
          fill={C.red}
          strokeWidth={3}
          {...line}
        />
        <path
          d="M-2.5 22 C-2 20 -1 19 0.5 18.5"
          stroke={C.white}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={0} cy={15} r={3} fill={C.sun} stroke={INK} strokeWidth={2.2} />
      </>
    );
  },
};

const ROYAL_DRAPE = "M-50 -14 C-66 -2 -86 26 -94 52 C-60 62 60 62 94 52 C86 26 66 -2 50 -14 Z";
const ROYAL_LINING = "M-42 -8 C-52 10 -60 30 -64 46 C-30 53 30 53 64 46 C60 30 52 10 42 -8 Z";
const ROYAL_HEM = "M-94 52 C-60 62 60 62 94 52 L91 42 C58 52 -58 52 -91 42 Z";
const ROYAL_COLLAR =
  "M-58 -12 C-30 0 30 0 58 -12 C59 -3 57 5 52 9 C30 17 -30 17 -52 9 C-57 5 -59 -3 -58 -12 Z";

/** Đốm đuôi chồn trên lông trắng (cổ và vạt áo choàng hoàng gia). */
function Ermine({ spots }: { spots: readonly (readonly [number, number])[] }) {
  return (
    <>
      {spots.map(([x, y]) => (
        <ellipse key={`${x},${y}`} cx={x} cy={y} rx={1.7} ry={3.2} fill={INK} />
      ))}
    </>
  );
}

const royalCape: AccessoryArt = {
  slot: "neck",
  layer: "back",
  box: [-97, -34, 194, 96],
  render: () => (
    <>
      <path d={ROYAL_DRAPE} fill={C.crimson} strokeWidth={5} {...line} />
      <path d={ROYAL_LINING} fill="#8f2238" strokeWidth={3} {...line} />
      <path
        d="M-74 40 C-70 28 -68 16 -64 4 M74 40 C70 28 68 16 64 4"
        fill="none"
        stroke="#8f2238"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d={ROYAL_HEM} fill={C.paper} strokeWidth={4} {...line} />
      <Ermine
        spots={[
          [-78, 50],
          [-52, 53],
          [-26, 55],
          [0, 55.5],
          [26, 55],
          [52, 53],
          [78, 50],
        ]}
      />
    </>
  ),
  front: (animated) => (
    <>
      <path d={ROYAL_COLLAR} fill={C.paper} strokeWidth={4} {...line} />
      <Ermine
        spots={[
          [-42, 3],
          [-21, 7],
          [0, 8],
          [21, 7],
          [42, 3],
        ]}
      />
      <path d="M-12 12 L12 12" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M-12 12 L12 12" stroke={C.sun} strokeWidth={2} strokeLinecap="round" />
      <circle cx={-12} cy={12} r={5} fill={C.sun} stroke={INK} strokeWidth={3} />
      <circle cx={12} cy={12} r={5} fill={C.sun} stroke={INK} strokeWidth={3} />
      <Sparkles
        animated={animated}
        points={[
          [66, -24, 7],
          [-70, -18, 5],
        ]}
      />
    </>
  ),
};

/** Hình vẽ của 24 món, khoá theo id trong `COSMETIC_ITEMS` (shared). */
export const ACCESSORY_ART: Record<CosmeticId, AccessoryArt> = {
  beanie,
  bow,
  cap,
  "flower-crown": flowerCrown,
  "witch-hat": witchHat,
  "grad-cap": gradCap,
  headphones,
  crown,
  cowboy,
  halo,
  "round-glasses": roundGlasses,
  sunglasses,
  bandage,
  "heart-glasses": heartGlasses,
  "hero-mask": heroMask,
  monocle,
  "star-glasses": starGlasses,
  scarf,
  bowtie,
  bell,
  cape,
  lei,
  pearls,
  "royal-cape": royalCape,
};

function artOf(id: string): AccessoryArt | undefined {
  return Object.hasOwn(ACCESSORY_ART, id) ? ACCESSORY_ART[id as CosmeticId] : undefined;
}

export interface WornAccessory {
  id: CosmeticId;
  art: AccessoryArt;
}

/**
 * Chia bộ món đang đeo theo lớp vẽ. Id lạ bị bỏ, mỗi chỗ giữ món đầu tiên (phòng khi chưa qua
 * `sanitizeLoadout`). `hideFace`: bỏ món chỗ mặt (avatar nhỏ).
 */
export function wornAccessories(
  ids: readonly string[] | undefined,
  hideFace = false,
): { back: WornAccessory[]; neck?: WornAccessory; face?: WornAccessory; head?: WornAccessory } {
  const bySlot: Partial<Record<AccessorySlot, WornAccessory>> = {};
  for (const id of ids ?? []) {
    const art = artOf(id);
    if (!art || bySlot[art.slot] || (hideFace && art.slot === "face")) continue;
    bySlot[art.slot] = { id: id as CosmeticId, art };
  }
  return {
    back: Object.values(bySlot).filter((w) => w.art.layer === "back"),
    neck: bySlot.neck,
    face: bySlot.face,
    head: bySlot.head,
  };
}

/** `translate(x y) rotate(r) scale(s)` theo điểm neo của loài. */
export function anchorTransform({ x, y, rotate, scale }: Anchor) {
  return `translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ""}${scale && scale !== 1 ? ` scale(${scale})` : ""}`;
}

interface AccessoryIconProps {
  id: string;
  /** Cạnh khung vuông, px */
  size?: number;
  /** Tên đọc cho trình đọc màn hình; bỏ trống thì chỉ để trang trí */
  label?: string;
  animated?: boolean;
  className?: string;
}

/**
 * Ảnh nhỏ một món (ô lưới tủ đồ, viên nang mở quà, danh sách tỉ lệ): món nằm giữa khung vuông,
 * không có nhân vật. Áo choàng vẽ cả vạt sau lẫn cổ áo.
 */
export function AccessoryIcon({
  id,
  size = 48,
  label,
  animated = false,
  className,
}: AccessoryIconProps) {
  const art = artOf(id);
  if (!art) return null;
  const [x, y, w, h] = art.box;
  const side = Math.max(w, h);
  const viewBox = `${r1(x + w / 2 - side / 2)} ${r1(y + h / 2 - side / 2)} ${side} ${side}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={cn("block shrink-0 overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {art.render(animated)}
      {art.front?.(animated)}
    </svg>
  );
}
