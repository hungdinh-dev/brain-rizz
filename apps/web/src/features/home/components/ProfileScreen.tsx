import { CHARACTER_IDS, MAX_NAME_LENGTH } from "@brain-rizz/shared";
import { CheckIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { DifficultyPicker } from "@/components/common/DifficultyPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Profile } from "../profile";

interface ProfileScreenProps {
  profile: Profile;
  onBack(): void;
  onConfirm(profile: Profile): void;
}

/** "Chọn bạn đồng hành": tên, nhân vật và độ khó. */
export function ProfileScreen({ profile, onBack, onConfirm }: ProfileScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [difficulty, setDifficulty] = useState(profile.difficulty);
  const trimmed = name.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed) onConfirm({ ...profile, name: trimmed, avatar, difficulty });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="sticker-text font-display text-4xl leading-none font-extrabold text-paper [--stroke:7px] md:text-5xl">
          {t("home.profile.title")}
        </h2>
        <p className="mt-2 text-chalk-muted">{t("home.profile.desc")}</p>
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 md:gap-6">
        <fieldset className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
          <legend className="sr-only">{t("home.profile.title")}</legend>
          {CHARACTER_IDS.map((id, i) => {
            const picked = id === avatar;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={picked}
                onClick={() => setAvatar(id)}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center rounded-3xl border-[3px] border-sticker px-1 pt-3 pb-3 text-card-foreground shadow-sticker transition-[translate,box-shadow] hover:-translate-y-1 active:translate-y-1 active:shadow-none",
                  picked ? "bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                {picked && (
                  <span className="absolute -top-3 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-sticker bg-compute text-paper">
                    <CheckIcon aria-hidden className="size-4" strokeWidth={3.5} />
                  </span>
                )}
                <Character id={id} mood={picked ? "happy" : "idle"} size={96} delay={-0.5 * i} />
                <span className="mt-1 font-display text-xl leading-none font-extrabold md:text-2xl">
                  {t(`characters.${id}.name`)}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    picked ? "text-primary-foreground/75" : "text-muted-foreground",
                  )}
                >
                  {t(`characters.${id}.species`)}
                </span>
              </button>
            );
          })}
        </fieldset>

        <Card size="sm">
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-name" className="text-muted-foreground">
                {t("home.profile.nameLabel")}
              </Label>
              <Input
                id="player-name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("home.profile.namePlaceholder")}
                autoComplete="nickname"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("home.profile.difficulty")}
              </span>
              <DifficultyPicker
                value={difficulty}
                onChange={setDifficulty}
                aria-label={t("home.profile.difficulty")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <p className="text-chalk-muted">
            {t("home.profile.picked")}{" "}
            <strong className="font-display text-2xl font-extrabold text-sun">
              {t(`characters.${avatar}.name`)}
            </strong>
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="chalk"
              data-sfx="back"
              className="rounded-2xl px-6"
              onClick={onBack}
            >
              {t("home.profile.back")}
            </Button>
            <Button type="submit" data-sfx="confirm" size="lg" disabled={!trimmed}>
              {t("home.profile.confirm")}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
