import { cn } from "@/lib/utils";

const INK = "#1f1b3a";

/** Linh vật "Não Rizz": bộ não hồng đeo kính râm. `mood="grin"` cười nhe răng (dùng ở menu). */
export function BrainMascot({
  size = 200,
  mood = "smile",
  label,
  className,
}: {
  size?: number;
  mood?: "smile" | "grin";
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      className={cn("block overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        d="M92 168 L88 198 M128 168 L132 198"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <ellipse cx={82} cy={202} rx={15} ry={7} fill={INK} />
      <ellipse cx={138} cy={202} rx={15} ry={7} fill={INK} />
      <path
        d="M32 116 C18 108 12 92 16 78"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <circle cx={16} cy={72} r={10} fill="#f7a8b8" stroke={INK} strokeWidth={5} />
      <path
        d="M190 120 C202 120 208 110 206 98"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <circle cx={205} cy={92} r={10} fill="#f7a8b8" stroke={INK} strokeWidth={5} />
      <path
        d="M60 150 C30 150 18 125 28 105 C12 92 18 62 42 58 C44 34 70 22 92 32 C104 14 136 14 146 32 C170 24 196 42 192 66 C212 78 210 110 192 120 C198 142 178 160 156 154 C146 170 118 172 106 158 C94 168 70 166 60 150 Z"
        fill="#f7a8b8"
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path
        d="M66 66 C76 56 94 60 96 74 M120 46 C130 58 148 54 154 66 M110 36 C104 52 114 60 108 76 M150 140 C160 134 172 140 174 130 M48 116 C56 124 70 118 76 128 M168 84 C178 84 184 92 182 100"
        fill="none"
        stroke="#d9687f"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path d="M62 92 L42 86 M160 92 L180 86" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <rect x={60} y={84} width={46} height={30} rx={12} fill={INK} />
      <rect x={114} y={84} width={46} height={30} rx={12} fill={INK} />
      <path d="M106 93 C110 88 110 88 114 93" fill="none" stroke={INK} strokeWidth={5} />
      <path
        d="M70 93 L80 104 M124 93 L134 104"
        stroke="#fff"
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <ellipse cx={74} cy={128} rx={10} ry={5.5} fill="#e85d75" opacity={0.5} />
      <ellipse cx={150} cy={126} rx={10} ry={5.5} fill="#e85d75" opacity={0.5} />
      {mood === "grin" ? (
        <path d="M98 124 L126 124 C126 140 98 140 98 124 Z" fill={INK} />
      ) : (
        <path
          d="M92 126 C102 140 124 140 136 122"
          fill="none"
          stroke={INK}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <path
        d="M186 30 C189 44 192 47 206 50 C192 53 189 56 186 70 C183 56 180 53 166 50 C180 47 183 44 186 30 Z"
        fill="#ffd166"
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
