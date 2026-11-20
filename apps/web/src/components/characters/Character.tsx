import type { CharacterId } from "@brain-rizz/shared";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { anchorTransform, type WornAccessory, wornAccessories } from "./accessories";
import {
  type Anchor,
  BODY_PATH,
  CHARACTER_SPECS,
  type CharacterSpec,
  type EyeStyle,
  INK,
} from "./specs";

/** Biểu cảm sticker, mỗi cái gắn với một tình huống trong game (vd. happy = trả lời đúng, sad = sai). */
export const MOODS = ["idle", "happy", "sad", "surprised", "angry", "thinking", "win"] as const;
export type Mood = (typeof MOODS)[number];

interface CharacterProps {
  id: CharacterId;
  mood?: Mood;
  /** Cạnh khung vuông, px */
  size?: number;
  /** Hoạt ảnh theo biểu cảm (tự tắt khi người dùng bật "giảm chuyển động") */
  animated?: boolean;
  /** Viền trắng kiểu nhãn dán — dùng khi đặt trên nền bảng tối */
  sticker?: boolean;
  /** Tên đọc cho trình đọc màn hình; bỏ trống thì nhân vật chỉ để trang trí */
  label?: string;
  /** Lệch nhịp hoạt ảnh (giây, âm = bắt đầu giữa chừng) khi nhiều nhân vật đứng cạnh nhau */
  delay?: number;
  /**
   * Phụ kiện đang đeo (id `COSMETIC_ITEMS`, đã qua `sanitizeLoadout`: ≤ 1 món mỗi chỗ). Id lạ bị
   * bỏ qua. Đặt theo `spec.anchors` của loài (accessories.tsx).
   */
  accessories?: readonly string[];
  /**
   * Ẩn món chỗ mặt (kính, mặt nạ…): bật ở avatar nhỏ ≤ 46 px để mặt khỏi rối (ui-ux 6.12).
   * Món đầu, cổ vẫn vẽ.
   */
  hideFaceAccessory?: boolean;
  className?: string;
}

/** Nhân vật chibi vẽ bằng SVG: 6 con vật × 7 biểu cảm, ghép từ thân riêng + mặt/tay/hiệu ứng chung. */
export function Character({
  id,
  mood = "idle",
  size = 96,
  animated = true,
  sticker = false,
  label,
  delay,
  accessories,
  hideFaceAccessory = false,
  className,
}: CharacterProps) {
  const spec = CHARACTER_SPECS[id];
  const worn = wornAccessories(accessories, hideFaceAccessory);
  // Id riêng mỗi nhân vật cho clipPath tai (nhiều nhân vật trên một trang không đụng nhau)
  const clipId = `ears${useId().replace(/[^\w-]/g, "")}`;

  return (
    <span
      className={cn("inline-block shrink-0", animated && `char-${mood}`, className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        className={cn("block overflow-visible", sticker && "sticker-outline")}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {mood === "sad" && <Gloom animated={animated} />}
        {/* Thứ tự lớp phụ kiện (mục 5.5): sau lưng → thân → cổ → mặt → đầu → tay, đạo cụ, hiệu ứng */}
        {worn.back.map((w) => (
          <g key={w.id} transform={anchorTransform(spec.anchors[w.art.slot])}>
            {w.art.render(animated)}
          </g>
        ))}
        {spec.back(animated)}
        <path d={BODY_PATH} fill={spec.fill} />
        {spec.patches}
        <path d={BODY_PATH} fill="none" stroke={INK} strokeWidth={6} />
        {spec.front}
        <Blush spec={spec} angry={mood === "angry"} />
        <Eyes spec={spec} mood={mood} animated={animated} />
        {spec.nose}
        <Mouth spec={spec} mood={mood} />
        <Worn item={worn.neck} anchor={spec.anchors.neck} animated={animated} />
        <Worn item={worn.face} anchor={spec.anchors.face} animated={animated} />
        <Worn
          item={worn.head}
          anchor={(worn.head && spec.anchors.headItems?.[worn.head.id]) || spec.anchors.head}
          animated={animated}
        />
        {worn.head && spec.ears && !worn.head.art.frontOfEars && (
          <EarsOverHead id={clipId} ears={spec.ears} />
        )}
        {mood === "idle" && spec.idleProp}
        {mood === "win" && <Medal />}
        {spec.paws && <Paws spec={spec} mood={mood} />}
        <Effects spec={spec} mood={mood} animated={animated} />
      </svg>
    </span>
  );
}

/** Một món ở lớp trước thân; món sau lưng (áo choàng) chỉ vẽ phần cổ áo ở đây. */
function Worn({
  item,
  anchor,
  animated,
}: {
  item: WornAccessory | undefined;
  anchor: Anchor;
  animated: boolean;
}) {
  if (!item) return null;
  const art = item.art;
  const node = art.layer === "back" ? art.front?.(animated) : art.render(animated);
  return node ? <g transform={anchorTransform(anchor)}>{node}</g> : null;
}

/** Ngoài viền thân: hình chữ nhật lớn trừ thân (evenodd). */
const OUTSIDE_BODY = `M-60 -60 H260 V260 H-60 Z ${BODY_PATH}`;

/**
 * Tai dài vẽ lại đè lên món đầu, chỉ phần nhô khỏi thân (chân tai vẫn khuất sau đầu như khi không
 * đội gì), kèm nửa ngoài viền đầu ở chân tai để tai có mép mực như bình thường.
 */
function EarsOverHead({ id, ears }: { id: string; ears: NonNullable<CharacterSpec["ears"]> }) {
  return (
    <>
      <clipPath id={`${id}o`}>
        <path d={OUTSIDE_BODY} clipRule="evenodd" />
      </clipPath>
      <clipPath id={`${id}e`}>
        <path d={ears.outline} />
      </clipPath>
      <g clipPath={`url(#${id}o)`}>
        {ears.art}
        <path d={BODY_PATH} fill="none" stroke={INK} strokeWidth={6} clipPath={`url(#${id}e)`} />
      </g>
    </>
  );
}

// ---------- Mặt ----------

function Blush({ spec, angry }: { spec: CharacterSpec; angry: boolean }) {
  const [l, r] = spec.blushX;
  const props = angry
    ? { rx: 11, ry: 6, fill: "#e85d75", opacity: 0.6 }
    : { rx: 9, ry: 5, fill: spec.blush, opacity: 0.85 };
  return (
    <>
      <ellipse cx={l} cy={spec.blushY} {...props} />
      <ellipse cx={r} cy={spec.blushY} {...props} />
    </>
  );
}

type EyeVariant = "normal" | "big" | "down" | "up";

function Eyes({ spec, mood, animated }: { spec: CharacterSpec; mood: Mood; animated: boolean }) {
  const [l, r] = spec.eyeX;
  const y = spec.eyeY;

  // Vui / thắng: mắt cười hình vòng cung
  if (mood === "happy" || mood === "win") {
    const arc = (x: number) =>
      `M${x - 12} ${y + 4} C${x - 8} ${y - 7} ${x + 8} ${y - 7} ${x + 12} ${y + 4}`;
    return (
      <path
        d={`${arc(l)} ${arc(r)}`}
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
    );
  }

  const variant: EyeVariant =
    mood === "surprised" ? "big" : mood === "sad" ? "down" : mood === "thinking" ? "up" : "normal";

  return (
    <>
      <g className={animated && mood === "idle" ? "fx fx-blink" : undefined}>
        <Eye style={spec.eyes} x={l} y={y} variant={variant} />
        <Eye style={spec.eyes} x={r} y={y} variant={variant} />
      </g>
      <Brows spec={spec} mood={mood} />
    </>
  );
}

function Eye({
  style,
  x,
  y,
  variant,
}: {
  style: EyeStyle;
  x: number;
  y: number;
  variant: EyeVariant;
}) {
  const big = variant === "big";
  const down = variant === "down";
  const up = variant === "up";

  if (style === "amber") {
    const r = big ? 15 : down ? 11 : 12;
    const [px, py] = up ? [3, -4] : down ? [0, 4] : big ? [0, 0] : [0, 1];
    return (
      <>
        <circle cx={x} cy={y} r={r} fill="#f2a33a" stroke={INK} strokeWidth={4} />
        <circle cx={x + px} cy={y + py} r={big ? 5 : 6.5} fill={INK} />
        <circle cx={x + px - 3} cy={y + py - 4} r={big ? 3.2 : 2.8} fill="#fff" />
      </>
    );
  }
  if (style === "dark") {
    const r = big ? 13.5 : down ? 11.5 : 10;
    const [ox, oy] = up ? [2, -2] : [0, 0];
    return (
      <>
        <circle cx={x + ox} cy={y + oy} r={r} fill="#2a1f2e" />
        <circle cx={x + ox - 3.5} cy={y + oy - 4} r={down ? 4.4 : 3.6} fill="#fff" />
        <circle cx={x + ox + 3.5} cy={y + oy + 4} r={down ? 2.2 : 1.6} fill="#fff" />
      </>
    );
  }
  if (style === "panda") {
    const [px, py] = up ? [1.5, -1.5] : down ? [0, 1.5] : [1, 0.5];
    return (
      <>
        <circle cx={x} cy={y} r={big ? 6.5 : 5} fill="#fff" />
        <circle cx={x + px} cy={y + py} r={big ? 2.4 : 3} fill={INK} />
      </>
    );
  }
  // bead: mắt hạt đậu
  const [ox, oy] = up ? [2, -3] : down ? [0, 2] : [0, 0];
  return (
    <>
      <ellipse cx={x + ox} cy={y + oy} rx={big ? 8 : 6} ry={big ? 10 : 7.5} fill={INK} />
      <circle cx={x + ox - 2} cy={y + oy - 3} r={down ? 2.8 : 2.2} fill="#fff" />
    </>
  );
}

function Brows({ spec, mood }: { spec: CharacterSpec; mood: Mood }) {
  const [l, r] = spec.eyeX;
  const y = spec.eyeY;
  const line = { stroke: INK, strokeLinecap: "round", fill: "none" } as const;

  if (mood === "sad") {
    return (
      <path
        d={`M${l - 14} ${y - 12} L${l + 10} ${y - 18} M${r + 14} ${y - 12} L${r - 10} ${y - 18}`}
        strokeWidth={4.5}
        {...line}
      />
    );
  }
  if (mood === "angry") {
    return (
      <>
        {/* Che nửa trên mắt bằng màu lông trán → mắt nheo lại */}
        <path
          d={`M${l - 16} ${y - 18} L${l + 16} ${y - 2} L${l + 16} ${y - 18} Z M${r + 16} ${y - 18} L${r - 16} ${y - 2} L${r - 16} ${y - 18} Z`}
          fill={spec.forehead}
        />
        <path
          d={`M${l - 16} ${y - 16} L${l + 14} ${y - 3} M${r + 16} ${y - 16} L${r - 14} ${y - 3}`}
          strokeWidth={6}
          {...line}
        />
      </>
    );
  }
  if (mood === "thinking") {
    return (
      <path
        d={`M${l - 12} ${y - 14} L${l + 10} ${y - 14} M${r - 12} ${y - 18} C${r - 6} ${y - 23} ${r + 4} ${y - 23} ${r + 12} ${y - 18}`}
        strokeWidth={4.5}
        {...line}
      />
    );
  }
  return null;
}

function Mouth({ spec, mood }: { spec: CharacterSpec; mood: Mood }) {
  if (spec.beak) {
    const open = mood === "happy" || mood === "win" || mood === "surprised" || mood === "angry";
    return open ? (
      <>
        <path
          d="M90 116 L100 106 L110 116 L100 128 Z"
          fill="#f2a541"
          stroke={INK}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        <path
          d="M90 116 L100 120 L110 116"
          fill="#8a3a4a"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </>
    ) : (
      <>
        <path
          d="M90 116 L100 108 L110 116 L100 125 Z"
          fill="#f2a541"
          stroke={INK}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        <path d="M91 116 L109 116" stroke={INK} strokeWidth={2.5} />
      </>
    );
  }

  const line = {
    fill: "none",
    stroke: INK,
    strokeWidth: 3.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  let mouth: ReactNode;
  switch (mood) {
    case "idle":
      if (spec.idleMouth) return spec.idleMouth;
      mouth = <path d="M91 125 C93 130 98 130 100 126 C102 130 107 130 109 125" {...line} />;
      break;
    case "happy":
    case "win":
      mouth = (
        <>
          <path
            d="M88 123 C90 140 110 140 112 123 C106 127 94 127 88 123 Z"
            fill="#8a3a4a"
            stroke={INK}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <path d="M94 132 C97 138 103 138 106 132 C103 129 97 129 94 132 Z" fill="#f27d93" />
        </>
      );
      break;
    case "sad":
      mouth = <path d="M91 131 C95 125 105 125 109 131" {...line} />;
      break;
    case "surprised":
      mouth = (
        <ellipse cx={100} cy={130} rx={4.5} ry={5.5} fill="#8a3a4a" stroke={INK} strokeWidth={3} />
      );
      break;
    case "angry":
      mouth = <path d="M89 131 L94 126 L100 131 L106 126 L111 131" {...line} />;
      break;
    case "thinking":
      mouth = <path d="M93 129 C98 131 104 129 108 126" {...line} />;
      break;
  }
  const dy = spec.mouthY - 125;
  return dy ? <g transform={`translate(0 ${dy})`}>{mouth}</g> : mouth;
}

// ---------- Tay, chân, đạo cụ ----------

function Paws({ spec, mood }: { spec: CharacterSpec; mood: Mood }) {
  const paw = (cx: number, cy: number, raised = false) => (
    <ellipse
      key={`${cx}-${cy}`}
      cx={cx}
      cy={cy}
      rx={raised ? 13 : 12}
      ry={raised ? 11 : 9}
      fill={spec.limb}
      stroke={INK}
      strokeWidth={raised ? 5 : 4}
    />
  );
  const positions: Record<Mood, [number, number, boolean?][]> = {
    idle: [
      [88, 166],
      [112, 166],
    ],
    sad: [
      [88, 168],
      [112, 168],
    ],
    surprised: [
      [91, 152],
      [109, 154],
    ],
    happy: [
      [40, 96, true],
      [160, 96, true],
    ],
    win: [
      [40, 92, true],
      [160, 92, true],
    ],
    angry: [
      [48, 152, true],
      [152, 152, true],
    ],
    thinking: [
      [86, 166],
      [114, 142, true],
    ],
  };
  return (
    <>
      {positions[mood].map(([x, y, raised]) => paw(x, y, raised))}
      <ellipse cx={72} cy={184} rx={16} ry={8} fill={spec.limb} stroke={INK} strokeWidth={5} />
      <ellipse cx={128} cy={184} rx={16} ry={8} fill={spec.limb} stroke={INK} strokeWidth={5} />
    </>
  );
}

function Medal() {
  return (
    <>
      <path
        d="M84 140 L100 156 L116 140"
        fill="none"
        stroke="#4d9de0"
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <circle cx={100} cy={162} r={13} fill="#ffd166" stroke={INK} strokeWidth={4} />
      <path
        d="M100 154 L102.5 159.5 L108 160 L104 164 L105 170 L100 167 L95 170 L96 164 L92 160 L97.5 159.5 Z"
        fill="#f2a541"
      />
    </>
  );
}

// ---------- Hiệu ứng ----------

function fx(animated: boolean, name: string) {
  return animated ? `fx ${name}` : undefined;
}

function Gloom({ animated }: { animated: boolean }) {
  return (
    <path
      className={fx(animated, "fx-gloom")}
      d="M72 6 L72 20 M90 2 L90 18 M110 2 L110 18 M128 6 L128 20"
      stroke="#4d9de0"
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}

/** Ngôi sao 4 cánh tâm (cx, cy), bán kính s. */
function sparklePath(cx: number, cy: number, s: number) {
  const k = s * 0.1;
  const m = s * 0.3;
  return `M${cx} ${cy - s} C${cx + k} ${cy - m} ${cx + m} ${cy - k} ${cx + s} ${cy} C${cx + m} ${cy + k} ${cx + k} ${cy + m} ${cx} ${cy + s} C${cx - k} ${cy + m} ${cx - m} ${cy + k} ${cx - s} ${cy} C${cx - m} ${cy - k} ${cx - k} ${cy - m} ${cx} ${cy - s} Z`;
}

function Sparkle({
  cx,
  cy,
  s,
  delay,
  animated,
}: {
  cx: number;
  cy: number;
  s: number;
  delay?: number;
  animated: boolean;
}) {
  return (
    <path
      className={fx(animated, "fx-sparkle")}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
      d={sparklePath(cx, cy, s)}
      fill="#ffd166"
      stroke={INK}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
  );
}

const CONFETTI = [
  { x: 28, y: 12, c: "#e85d75", d: 0 },
  { x: 62, y: 2, c: "#3bb273", d: -0.6 },
  { x: 134, y: 4, c: "#4d9de0", d: -1.2 },
  { x: 170, y: 18, c: "#ffd166", d: -1.7 },
  { x: 10, y: 40, c: "#a08ce0", d: -0.9 },
  { x: 184, y: 44, c: "#f2a541", d: -0.3 },
];

function Effects({ spec, mood, animated }: { spec: CharacterSpec; mood: Mood; animated: boolean }) {
  switch (mood) {
    case "happy":
      return (
        <>
          <Sparkle cx={28} cy={30} s={11} animated={animated} />
          <Sparkle cx={172} cy={24} s={10} delay={-0.5} animated={animated} />
          <Sparkle cx={100} cy={11} s={7} delay={-1} animated={animated} />
        </>
      );
    case "sad":
      return (
        <path
          className={fx(animated, "fx-tear")}
          transform={`translate(${spec.eyeX[0] - 76} ${spec.eyeY - 102})`}
          d="M66 114 C61 122 62 128 67 128 C72 128 72 122 66 114 Z"
          fill="#8ec5ff"
          stroke={INK}
          strokeWidth={2.5}
        />
      );
    case "surprised":
      return (
        <>
          <path
            d="M12 32 L22 42 M6 56 L18 58 M30 14 L36 26"
            stroke={INK}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <g className={fx(animated, "fx-mark")}>
            <path d="M182 6 L177 34" stroke="#ffd166" strokeWidth={9} strokeLinecap="round" />
            <circle cx={175} cy={47} r={5} fill="#ffd166" />
          </g>
        </>
      );
    case "angry":
      return (
        <>
          <path
            className={fx(animated, "fx-mark")}
            d="M150 8 C154 12 154 16 150 20 M166 8 C162 12 162 16 166 20 M152 6 C156 10 160 10 164 6 M152 22 C156 18 160 18 164 22"
            fill="none"
            stroke="#e85d75"
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <g className={fx(animated, "fx-puff")}>
            <circle cx={30} cy={32} r={8} fill="#fff" stroke={INK} strokeWidth={3.5} />
            <circle cx={20} cy={20} r={5} fill="#fff" stroke={INK} strokeWidth={3} />
          </g>
          <g className={fx(animated, "fx-puff")} style={{ animationDelay: "-0.7s" }}>
            <circle cx={182} cy={40} r={8} fill="#fff" stroke={INK} strokeWidth={3.5} />
            <circle cx={192} cy={28} r={5} fill="#fff" stroke={INK} strokeWidth={3} />
          </g>
        </>
      );
    case "thinking":
      return (
        <g className={fx(animated, "fx-bubble")}>
          <circle cx={164} cy={40} r={3.5} fill="#fff" stroke={INK} strokeWidth={3} />
          <circle cx={172} cy={30} r={5.5} fill="#fff" stroke={INK} strokeWidth={3} />
          <circle cx={183} cy={15} r={13} fill="#fff" stroke={INK} strokeWidth={3.5} />
          <text
            x={183}
            y={22}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontWeight={800}
            fontSize={20}
            fill={INK}
          >
            ?
          </text>
        </g>
      );
    case "win":
      return (
        <>
          {CONFETTI.map((c) => (
            <rect
              key={c.x}
              className={fx(animated, "fx-confetti")}
              style={c.d ? { animationDelay: `${c.d}s` } : undefined}
              x={c.x}
              y={c.y}
              width={8}
              height={5}
              rx={1.5}
              fill={c.c}
            />
          ))}
          <Sparkle cx={172} cy={70} s={8} delay={-0.4} animated={animated} />
        </>
      );
    default:
      return null;
  }
}
