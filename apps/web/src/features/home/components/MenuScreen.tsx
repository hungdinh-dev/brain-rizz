import {
  CATEGORIES,
  GAME_IDS,
  isValidRoomCode,
  MAX_PLAYERS,
  normalizeRoomCode,
} from "@brain-rizz/shared";
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  DoorOpenIcon,
  GlobeIcon,
  HousePlusIcon,
  LayoutGridIcon,
  PencilIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BrainMascot, Logo } from "@/components/brand";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { Profile } from "../profile";
import { MenuCard } from "./MenuCard";

/** Tổng số minigame dự kiến (danh mục ở docs/04-minigames/README.md). */
const PLANNED_GAMES = 15;

const SKILL_DOTS = ["bg-identify", "bg-memorize", "bg-analyze", "bg-compute", "bg-visualize"];

interface MenuScreenProps {
  profile: Profile;
  initialCode: string;
  busy: boolean;
  onEditProfile(): void;
  onCreate(): void;
  onJoin(code: string): void;
}

/** Menu chính: tạo/vào phòng, các chế độ chơi, thử thách hằng ngày. */
export function MenuScreen({
  profile,
  initialCode,
  busy,
  onEditProfile,
  onCreate,
  onJoin,
}: MenuScreenProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode);
  const soon = () => toast(t("home.menu.soonToast"));
  // Gợi ý nhóm kỹ năng đổi theo ngày trong tuần
  const tipCategory = CATEGORIES[new Date().getDay() % CATEGORIES.length] ?? "identify";

  function submitJoin(e: FormEvent) {
    e.preventDefault();
    if (isValidRoomCode(code)) onJoin(code);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 md:gap-6">
      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" className="hidden md:flex" />
        {/* Trên điện thoại logo ẩn đi; vẫn giữ một h1 cho trình đọc màn hình */}
        <h1 className="sr-only md:hidden">Brain Rizz</h1>
        <button
          type="button"
          onClick={onEditProfile}
          className="flex min-w-0 items-center gap-2 rounded-full border-[3px] border-sticker bg-card py-1 pr-4 pl-1 text-left text-card-foreground shadow-sticker-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          <PlayerAvatar avatar={profile.avatar} colorIndex={profile.colorIndex} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-display text-lg font-extrabold">
              {profile.name || t(`characters.${profile.avatar}.name`)}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <PencilIcon aria-hidden className="size-3" />
              {t("home.menu.editProfile")}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="chalk"
            size="icon-chalk"
            aria-label={t("home.menu.howTo")}
            title={t("home.menu.howTo")}
            onClick={() => toast(t("home.menu.howToToast"))}
          >
            <CircleHelpIcon />
          </Button>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Lời chào + linh vật: chỉ trên điện thoại (desktop đặt linh vật ở cột phải) */}
      <div className="flex items-center justify-between md:hidden">
        <h2 className="font-display text-3xl leading-none font-extrabold text-chalk">
          {t("home.menu.hello")}
        </h2>
        <BrainMascot size={72} className="char-idle" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
        <div className="grid grid-cols-2 gap-3.5 md:gap-5">
          <MenuCard
            tone="mint"
            tilt="left"
            icon={HousePlusIcon}
            title={t("home.menu.createTitle")}
            description={t("home.menu.createDesc")}
            onClick={onCreate}
          >
            <span className="hidden flex-wrap gap-1.5 md:flex">
              <Chip>{t("home.menu.players", { max: MAX_PLAYERS })}</Chip>
              <Chip>{t("home.menu.sameWifi")}</Chip>
            </span>
          </MenuCard>

          <MenuCard
            tone="sky"
            tilt="right"
            icon={DoorOpenIcon}
            title={t("home.menu.joinTitle")}
            description={t("home.menu.joinDesc")}
          >
            <form onSubmit={submitJoin} className="flex w-full flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                placeholder={t("home.menu.codePlaceholder")}
                aria-label={t("lobby.roomCode")}
                maxLength={4}
                autoComplete="off"
                autoCapitalize="characters"
                className="h-12 w-full min-w-0 rounded-2xl border-[3px] border-ink bg-paper pl-[0.4em] text-center font-display text-2xl font-extrabold tracking-[0.4em] text-ink uppercase outline-none placeholder:text-ink/35 focus-visible:ring-4 focus-visible:ring-ring md:h-14 md:text-3xl"
              />
              <button
                type="submit"
                disabled={busy || !isValidRoomCode(code)}
                className="h-12 shrink-0 cursor-pointer rounded-2xl border-[3px] border-ink bg-ink px-5 font-display text-xl font-extrabold text-sun shadow-[0_4px_0_var(--color-ink)] transition-transform active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 md:h-14 md:text-2xl"
              >
                {t("home.menu.join")}
              </button>
            </form>
          </MenuCard>

          <MenuCard
            tone="pink"
            tilt="right"
            icon={GlobeIcon}
            badge={t("home.menu.soon")}
            title={t("home.menu.matchTitle")}
            description={t("home.menu.matchDesc")}
            onClick={soon}
          />

          <MenuCard
            tone="sun"
            tilt="left"
            icon={TargetIcon}
            badge={t("home.menu.soon")}
            title={t("home.menu.practiceTitle")}
            description={t("home.menu.practiceDesc")}
            onClick={soon}
          >
            <span className="hidden items-center gap-1.5 md:flex">
              {SKILL_DOTS.map((dot) => (
                <span
                  key={dot}
                  aria-hidden
                  className={`size-5 rounded-full border-[3px] border-ink ${dot}`}
                />
              ))}
              <span className="ml-1 text-[13px] font-bold">{t("home.menu.skillGroups")}</span>
            </span>
          </MenuCard>
        </div>

        <aside className="flex flex-col gap-3.5">
          <button
            type="button"
            onClick={soon}
            className="relative flex cursor-pointer flex-col gap-2 rounded-3xl border-[3.5px] border-ink bg-grape p-4 text-left text-ink shadow-[0_6px_0_var(--color-ink)] transition-[translate,box-shadow] hover:-translate-y-1 active:translate-y-1 active:shadow-none"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border-[3px] border-ink bg-paper">
                <CalendarDaysIcon aria-hidden className="size-6" strokeWidth={2.3} />
              </span>
              <span className="flex-1 font-display text-2xl leading-none font-extrabold">
                {t("home.menu.dailyTitle")}
              </span>
              <span className="rotate-6 rounded-lg border-[2.5px] border-ink bg-paper px-2 font-display text-xs font-extrabold">
                {t("home.menu.soon")}
              </span>
            </span>
            <span className="text-sm text-ink/80">{t("home.menu.dailyDesc")}</span>
            <span className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="grid h-14 place-items-center rounded-xl border-[3px] border-dashed border-ink bg-paper/50 font-display text-2xl font-extrabold"
                >
                  ?
                </span>
              ))}
            </span>
          </button>

          <MenuRow
            icon={TrophyIcon}
            tone="bg-sun"
            title={t("home.menu.leaderboard")}
            description={t("home.menu.leaderboardDesc")}
            onClick={soon}
          />
          <MenuRow
            icon={LayoutGridIcon}
            tone="bg-sky"
            title={t("home.menu.collection")}
            description={t("home.menu.collectionDesc", {
              count: GAME_IDS.length,
              total: PLANNED_GAMES,
            })}
            onClick={soon}
          />

          <div className="mt-auto hidden items-end justify-end gap-2 lg:flex">
            <p className="mb-14 max-w-48 -rotate-3 rounded-2xl border-[2.5px] border-chalk px-4 py-2 font-display text-lg leading-tight font-bold text-chalk">
              {t("home.menu.mascotTip", { category: t(`category.${tipCategory}`) })}
            </p>
            <BrainMascot size={140} mood="grin" className="char-idle" />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-ink/12 px-2.5 py-1 text-[13px] font-bold">{children}</span>
  );
}

function MenuRow({
  icon: Icon,
  tone,
  title,
  description,
  onClick,
}: {
  icon: typeof TrophyIcon;
  tone: string;
  title: string;
  description: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-[3px] border-sticker bg-card px-3.5 text-left text-card-foreground shadow-sticker-sm transition-[translate,box-shadow] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl border-[3px] border-ink text-ink ${tone}`}
      >
        <Icon aria-hidden className="size-5" strokeWidth={2.3} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="font-display text-lg font-extrabold">{title}</span>
        <span className="truncate text-[13px] text-muted-foreground">{description}</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.6} />
    </button>
  );
}
