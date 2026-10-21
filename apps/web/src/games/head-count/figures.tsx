import type { ReactNode } from "react";

/*
 * Hình người của Đếm sĩ số (đặc tả docs/04-minigames/head-count.md, mục "Phân biệt bằng dáng").
 * Vẽ bằng phần tử SVG cơ bản (path, circle, ellipse, rect, g) để một nguồn dùng cho hai nơi: scene
 * vẽ lên canvas 2D (../_shared/canvas-svg.ts) rồi tạo texture, hình minh hoạ đặt thẳng vào
 * <svg>. Gốc toạ độ ở giữa hai bàn chân, trục y hướng lên là số âm.
 *
 * - Bạn học sinh: thấp, đầu tròn, đeo cặp. Quay mặt (đi ra) thấy mặt và quai cặp; quay lưng (đi
 *   vào) thấy cả chiếc cặp, đầu toàn tóc.
 * - Thầy giáo: cao gấp ~1,4 lần, áo vest, không đeo cặp. Quay mặt thấy kính, cà vạt, ôm sách
 *   trước bụng; quay lưng thấy sách kẹp bên nách. Nhận ra bằng dáng kể cả khi xem đen trắng.
 */

/** Màu vẽ riêng của nhân vật (bảng màu thương hiệu, giống nhau ở hai giao diện). */
const INK = "#1f1b3a";
const SKIN = "#f6cf9f";
const BLUSH = "#f7a8b8";
const PANTS = "#4b4558";
const PAPER = "#fff8ef";
const TEACHER_COLOR = {
  jacket: "#7768ae",
  tie: "#e85d75",
  book: "#4d9de0",
  hair: "#8e94a7",
} as const;

/** Màu áo, cặp, tóc của bạn học sinh; FE tự chọn theo chỉ số câu và lượt (không ảnh hưởng luật). */
const SHIRTS = ["#7fd1ae", "#f7a8b8", "#ffd166", "#8ec5ff", "#c3a6ff", "#f2a541"] as const;
const BAGS = ["#e85d75", "#4d9de0", "#3bb273", "#7768ae", "#f2a541", "#e85d75"] as const;
const HAIRS = ["#1f1b3a", "#a8693b", "#6b4528", "#1f1b3a", "#a8693b", "#6b4528"] as const;
/** Số kiểu bạn học sinh khác nhau (áo + cặp + tóc). */
export const KID_LOOKS = SHIRTS.length;

/** Khung bao (đơn vị hình): bạn học sinh rộng 60, cao 128; thầy rộng 80, cao 180 (~1,4 lần). */
export const KID_BOX = { w: 60, h: 128 } as const;
export const TEACHER_BOX = { w: 80, h: 180 } as const;

export type Facing = "front" | "back";

const ink = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** Tay: ống tay dày viền mực, bàn tay tròn ở cuối. */
function arm(d: string, sleeve: string, hand: readonly [number, number], width = 9): ReactNode {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 7} strokeLinecap="round" />
      <path d={d} fill="none" stroke={sleeve} strokeWidth={width} strokeLinecap="round" />
      <circle cx={hand[0]} cy={hand[1]} r={5.5} fill={SKIN} strokeWidth={3} {...ink} />
    </>
  );
}

function legs(top: number, width: number, gap: number): ReactNode {
  const h = -4 - top;
  return (
    <>
      <rect x={-gap - width} y={top} width={width} height={h} rx={5} fill={PANTS} />
      <rect x={gap} y={top} width={width} height={h} rx={5} fill={PANTS} />
      <rect
        x={-gap - width}
        y={top}
        width={width}
        height={h}
        rx={5}
        fill="none"
        strokeWidth={3.5}
        {...ink}
      />
      <rect
        x={gap}
        y={top}
        width={width}
        height={h}
        rx={5}
        fill="none"
        strokeWidth={3.5}
        {...ink}
      />
      <ellipse cx={-gap - width / 2} cy={-4} rx={width / 2 + 5} ry={5.5} fill={INK} />
      <ellipse cx={gap + width / 2} cy={-4} rx={width / 2 + 5} ry={5.5} fill={INK} />
    </>
  );
}

/** Áo bạn học sinh: thân bo góc từ vai (y −74) xuống hông (y −28). */
const KID_SHIRT =
  "M-15 -74 L15 -74 C21 -74 25 -70 25 -64 L25 -36 C25 -31 22 -28 17 -28 L-17 -28 C-22 -28 -25 -31 -25 -36 L-25 -64 C-25 -70 -21 -74 -15 -74 Z";

/** Một bạn học sinh kiểu `look` (0…KID_LOOKS − 1). */
export function kidArt(look: number, facing: Facing): ReactNode {
  const i = ((look % KID_LOOKS) + KID_LOOKS) % KID_LOOKS;
  const shirt = SHIRTS[i] ?? SHIRTS[0];
  const bag = BAGS[i] ?? BAGS[0];
  const hair = HAIRS[i] ?? HAIRS[0];

  if (facing === "back") {
    return (
      <g>
        {legs(-34, 11, 3)}
        {arm("M-22 -66 L-26 -44", shirt, [-26, -39])}
        {arm("M22 -66 L26 -44", shirt, [26, -39])}
        <path d={KID_SHIRT} fill={shirt} strokeWidth={4} {...ink} />
        {/* Cặp đeo sau lưng: thân, nắp, túi trước */}
        <rect x={-19} y={-73} width={38} height={44} rx={11} fill={bag} strokeWidth={4} {...ink} />
        <path d="M-19 -57 L19 -57" fill="none" strokeWidth={3.5} {...ink} />
        <rect x={-10} y={-50} width={20} height={14} rx={5} fill="none" strokeWidth={3} {...ink} />
        <circle cx={0} cy={-57} r={3.2} fill={PAPER} strokeWidth={2.5} {...ink} />
        {/* Đầu nhìn từ sau: tai hai bên, toàn tóc, xoáy tóc */}
        <circle cx={-24} cy={-95} r={5.5} fill={SKIN} strokeWidth={3} {...ink} />
        <circle cx={24} cy={-95} r={5.5} fill={SKIN} strokeWidth={3} {...ink} />
        <circle cx={0} cy={-99} r={25} fill={hair} strokeWidth={4} {...ink} />
        <path
          d="M-3 -114 C4 -117 8 -110 2 -107"
          fill="none"
          stroke={PAPER}
          strokeOpacity={0.45}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return (
    <g>
      {legs(-34, 11, 3)}
      {/* Hai mép cặp ló ra sau lưng */}
      <rect x={-30} y={-70} width={12} height={34} rx={5} fill={bag} strokeWidth={3.5} {...ink} />
      <rect x={18} y={-70} width={12} height={34} rx={5} fill={bag} strokeWidth={3.5} {...ink} />
      {arm("M-22 -66 L-26 -44", shirt, [-26, -39])}
      {arm("M22 -66 L26 -44", shirt, [26, -39])}
      <path d={KID_SHIRT} fill={shirt} strokeWidth={4} {...ink} />
      {/* Quai cặp trên vai, cổ áo */}
      <path
        d="M-13 -73 L-13 -48 M13 -73 L13 -48"
        fill="none"
        stroke={bag}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path d="M-7 -74 L0 -67 L7 -74" fill="none" strokeWidth={3} {...ink} />
      {/* Đầu: mặt, tóc mái, mắt, má, miệng cười */}
      <circle cx={0} cy={-99} r={25} fill={SKIN} strokeWidth={4} {...ink} />
      <path
        d="M-25 -98 C-27 -120 -14 -127 0 -127 C14 -127 27 -120 25 -98 C21 -107 13 -111 5 -107 C-1 -113 -15 -111 -25 -98 Z"
        fill={hair}
        strokeWidth={4}
        {...ink}
      />
      <circle cx={-9} cy={-95} r={3.4} fill={INK} />
      <circle cx={9} cy={-95} r={3.4} fill={INK} />
      <ellipse cx={-15} cy={-87} rx={5} ry={3} fill={BLUSH} />
      <ellipse cx={15} cy={-87} rx={5} ry={3} fill={BLUSH} />
      <path d="M-6 -86 C-3 -81 3 -81 6 -86" fill="none" strokeWidth={3} {...ink} />
    </g>
  );
}

/** Áo vest của thầy: vai rộng (y −128) xuống hông (y −58). */
const JACKET =
  "M-20 -128 L20 -128 C27 -128 31 -123 31 -116 L31 -66 C31 -61 28 -58 23 -58 L-23 -58 C-28 -58 -31 -61 -31 -66 L-31 -116 C-31 -123 -27 -128 -20 -128 Z";

/** Thầy giáo: cao, áo vest, kính, cà vạt, ôm sách; không đeo cặp. */
export function teacherArt(facing: Facing): ReactNode {
  const c = TEACHER_COLOR;
  if (facing === "back") {
    return (
      <g>
        {legs(-66, 13, 2)}
        {arm("M-24 -118 L-33 -82", c.jacket, [-34, -77], 10)}
        <path d={JACKET} fill={c.jacket} strokeWidth={4} {...ink} />
        <path d="M0 -120 L0 -60" fill="none" strokeWidth={2.5} opacity={0.5} {...ink} />
        <path d="M-12 -128 L0 -121 L12 -128" fill="none" strokeWidth={3} {...ink} />
        {/* Sách kẹp bên nách, ló ra mép phải */}
        <rect
          x={22}
          y={-114}
          width={14}
          height={36}
          rx={3}
          fill={c.book}
          strokeWidth={3.5}
          {...ink}
        />
        <path d="M33 -111 L33 -81" fill="none" stroke={PAPER} strokeWidth={3} />
        {arm("M24 -118 L30 -92", c.jacket, [31, -88], 10)}
        {/* Đầu nhìn từ sau: tai, tóc bạc, gọng kính vắt tai */}
        <circle cx={-26} cy={-148} r={6} fill={SKIN} strokeWidth={3} {...ink} />
        <circle cx={26} cy={-148} r={6} fill={SKIN} strokeWidth={3} {...ink} />
        <circle cx={0} cy={-151} r={26} fill={c.hair} strokeWidth={4} {...ink} />
        <path d="M-29 -152 L-22 -152 M29 -152 L22 -152" fill="none" strokeWidth={3} {...ink} />
      </g>
    );
  }

  return (
    <g>
      {legs(-66, 13, 2)}
      <path d={JACKET} fill={c.jacket} strokeWidth={4} {...ink} />
      {/* Cổ áo sơ mi trắng chữ V, cà vạt */}
      <path d="M-12 -128 L0 -106 L12 -128 Z" fill={PAPER} strokeWidth={3} {...ink} />
      <path
        d="M-4 -126 L4 -126 L5 -118 L0 -100 L-5 -118 Z"
        fill={c.tie}
        strokeWidth={2.5}
        {...ink}
      />
      {/* Sách ôm trước bụng, hai tay vòng giữ */}
      <g transform="rotate(-8 -6 -84)">
        <rect
          x={-26}
          y={-100}
          width={38}
          height={30}
          rx={3}
          fill={c.book}
          strokeWidth={3.5}
          {...ink}
        />
        <path d="M-24 -74 L10 -74" fill="none" stroke={PAPER} strokeWidth={3} />
        <path d="M-17 -100 L-17 -70" fill="none" strokeWidth={2.5} opacity={0.6} {...ink} />
      </g>
      {arm("M-26 -118 L-22 -86", c.jacket, [-20, -82], 10)}
      {arm("M26 -118 L12 -88", c.jacket, [9, -86], 10)}
      {/* Đầu: mặt, tóc bạc ngắn, kính tròn, ria */}
      <circle cx={0} cy={-151} r={26} fill={SKIN} strokeWidth={4} {...ink} />
      <path
        d="M-26 -150 C-28 -171 -15 -179 0 -179 C15 -179 28 -171 26 -150 C23 -160 17 -165 9 -164 L-9 -164 C-17 -165 -23 -160 -26 -150 Z"
        fill={c.hair}
        strokeWidth={4}
        {...ink}
      />
      <circle
        cx={-10.5}
        cy={-149}
        r={8.5}
        fill={PAPER}
        fillOpacity={0.55}
        strokeWidth={3.5}
        {...ink}
      />
      <circle
        cx={10.5}
        cy={-149}
        r={8.5}
        fill={PAPER}
        fillOpacity={0.55}
        strokeWidth={3.5}
        {...ink}
      />
      <path
        d="M-2 -150 L2 -150 M-19 -151 L-25 -153 M19 -151 L25 -153"
        fill="none"
        strokeWidth={3}
        {...ink}
      />
      <circle cx={-10.5} cy={-149} r={2.6} fill={INK} />
      <circle cx={10.5} cy={-149} r={2.6} fill={INK} />
      <path
        d="M-10 -134 C-6 -139 -1 -138 0 -135 C1 -138 6 -139 10 -134 C6 -131 -6 -131 -10 -134 Z"
        fill={c.hair}
        strokeWidth={2.5}
        {...ink}
      />
    </g>
  );
}
