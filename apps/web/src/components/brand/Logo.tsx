import { cn } from "@/lib/utils";

/* Mỗi chữ nghiêng/nhún một chút cho cảm giác vẽ tay. Tên thương hiệu không dịch nên không qua t(). */
const BRAIN = [
  { ch: "B", cls: "-rotate-[7deg] translate-y-[3%]" },
  { ch: "r", cls: "rotate-[4deg] -translate-y-[6%]" },
  { ch: "a", cls: "-rotate-[3deg] translate-y-[2%]" },
  { ch: "i", cls: "rotate-[7deg] -translate-y-[7%]" },
  { ch: "n", cls: "-rotate-[4deg]" },
];
const RIZZ = [
  { ch: "R", cls: "rotate-[5deg] -translate-y-[1%]" },
  { ch: "i", cls: "-rotate-[6deg] translate-y-[4%]" },
  { ch: "z", cls: "rotate-[4deg] -translate-y-[4%]" },
  { ch: "z", cls: "-rotate-[5deg] translate-y-[3%]" },
];

const SIZES = {
  /** Màn giới thiệu */
  lg: {
    wrap: "[--stroke:11px] md:[--stroke:16px]",
    brain: "text-8xl md:text-[150px]",
    rizz: "text-[112px] md:text-[176px]",
  },
  /** Thanh trên của menu: một dòng */
  sm: { wrap: "[--stroke:7px]", brain: "text-4xl md:text-5xl", rizz: "text-4xl md:text-5xl" },
} as const;

export function Logo({
  size = "lg",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const inline = size === "sm";
  return (
    <h1
      aria-label="Brain Rizz"
      className={cn(
        "m-0 flex font-display leading-[0.8] font-extrabold tracking-tight select-none",
        inline ? "flex-row items-baseline gap-2" : "flex-col items-center",
        s.wrap,
        className,
      )}
    >
      <span aria-hidden className={cn("flex text-paper", s.brain)}>
        {BRAIN.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: chữ cố định, không đổi thứ tự
          <span key={i} className={cn("sticker-text inline-block", !inline && l.cls)}>
            {l.ch}
          </span>
        ))}
      </span>
      <span aria-hidden className={cn("flex text-sun", s.rizz, !inline && "-mt-1")}>
        {RIZZ.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: chữ cố định, không đổi thứ tự
          <span key={i} className={cn("sticker-text inline-block", !inline && l.cls)}>
            {l.ch}
          </span>
        ))}
      </span>
    </h1>
  );
}
