import { MAX_PLAYERS } from "@brain-rizz/shared";
import { PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrainMascot, ChalkDoodle, type DoodleShape, Logo } from "@/components/brand";
import { Character, type Mood } from "@/components/characters";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { MotionToggle } from "@/features/motion";
import { MusicBar } from "@/features/music";
import { SfxToggle } from "@/features/sfx";
import { SkillChips } from "./SkillChips";

/* Hình phấn quanh mép bảng; hình ở giữa ẩn trên điện thoại để khỏi đè logo. */
const DOODLES: { shape: DoodleShape; className: string; delay: number }[] = [
  {
    shape: "star",
    className: "left-[4%] top-[5%] size-14 text-mint md:size-20 -rotate-12",
    delay: -1,
  },
  { shape: "sparkle", className: "left-[24%] top-[7%] hidden size-7 text-sun md:block", delay: -3 },
  {
    shape: "question",
    className: "left-[15%] top-[18%] size-11 text-sun md:size-16 rotate-6",
    delay: -2,
  },
  {
    shape: "three",
    className: "left-[5%] top-[32%] hidden size-14 text-sky sm:block md:size-16",
    delay: -4,
  },
  { shape: "puzzle", className: "left-[3%] top-[52%] size-12 text-sky md:size-20", delay: -5 },
  {
    shape: "magnifier",
    className: "left-[17%] top-[45%] hidden size-16 text-identify md:block",
    delay: -2.5,
  },
  { shape: "math", className: "left-[10%] top-[66%] hidden size-20 text-mint md:block", delay: -6 },
  {
    shape: "bulb",
    className: "right-[22%] top-[5%] hidden size-20 text-sun md:block",
    delay: -1.5,
  },
  {
    shape: "triangle",
    className: "right-[5%] top-[15%] size-10 text-mint md:size-14 rotate-12",
    delay: -3.5,
  },
  { shape: "clock", className: "right-[6%] top-[31%] size-12 text-sky md:size-20", delay: -4.5 },
  {
    shape: "dice",
    className: "right-[4%] top-[50%] size-11 text-pink md:size-16 rotate-12",
    delay: -0.5,
  },
  {
    shape: "cube",
    className: "right-[13%] top-[65%] hidden size-14 text-grape md:block",
    delay: -5.5,
  },
  {
    shape: "pencil",
    className: "right-[24%] top-[76%] hidden size-16 text-sun lg:block",
    delay: -1.2,
  },
];

/* Bốn bạn nhỏ ngồi trên mép bảng, mỗi bạn một biểu cảm. */
const CREW: { id: "khoi" | "bo" | "mochi" | "bap"; mood: Mood }[] = [
  { id: "khoi", mood: "surprised" },
  { id: "bo", mood: "happy" },
  { id: "mochi", mood: "thinking" },
  { id: "bap", mood: "idle" },
];

/** Màn chờ đầu tiên: logo, linh vật, nút "Chạm để bắt đầu". */
export function IntroScreen({ onStart }: { onStart(): void }) {
  const { t } = useTranslation();

  return (
    <main className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden pt-16 pb-32 md:pt-6 md:pb-36">
      {DOODLES.map((d) => (
        <span
          key={d.shape}
          aria-hidden
          className={`fx-float pointer-events-none absolute ${d.className}`}
          style={{ animationDelay: `${d.delay}s` }}
        >
          <ChalkDoodle shape={d.shape} className="size-full" />
        </span>
      ))}

      {/* Điện thoại: pt-16 của main chừa chỗ cho hàng nút này, khỏi đè nhãn trên logo */}
      <div className="absolute top-0 right-0 z-20 flex max-w-full flex-wrap justify-end gap-2">
        <MusicBar />
        <SfxToggle />
        <MotionToggle />
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 md:gap-4">
        <span className="rounded-full border-[2.5px] border-dashed border-chalk/75 px-4 py-1 font-display text-sm font-bold tracking-[0.2em] text-chalk uppercase md:text-base">
          {t("home.intro.kicker")}
        </span>

        <BrainMascot size={128} className="char-idle md:hidden" />

        <div className="relative">
          <Logo size="lg" />
          <div className="absolute top-16 left-full -ml-2 hidden md:block">
            <span className="absolute -top-14 left-10 rotate-3 rounded-2xl border-[2.5px] border-chalk px-4 py-1.5 font-display text-xl font-bold whitespace-nowrap text-chalk">
              {t("home.intro.ready")}
            </span>
            <BrainMascot size={200} className="char-idle" />
          </div>
        </div>

        <p className="max-w-xs text-center font-display text-lg leading-snug font-semibold text-chalk-muted md:max-w-none md:text-2xl">
          {t("home.intro.tagline", { max: MAX_PLAYERS })}
        </p>

        <Button
          size="lg"
          className="fx-pulse mt-2 h-auto rounded-full px-8 py-3 text-2xl md:px-11 md:text-3xl [&_svg:not([class*='size-'])]:size-6"
          onClick={onStart}
          data-sfx="confirm"
        >
          <PlayIcon className="fill-current" />
          {t("home.intro.start")}
        </Button>

        <SkillChips className="mt-2 max-w-sm md:max-w-none" />
      </div>

      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-end gap-0.5 md:left-2 md:translate-x-0 [&_svg]:size-[70px] md:[&_svg]:size-[88px]"
      >
        {CREW.map((c, i) => (
          <Character key={c.id} id={c.id} mood={c.mood} sticker size={88} delay={-0.7 * i} />
        ))}
      </div>

      <p className="absolute right-1 bottom-1 hidden text-xs text-chalk-muted md:block">
        {t("home.intro.version")}
      </p>
    </main>
  );
}
