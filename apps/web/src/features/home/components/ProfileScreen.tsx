import { CHARACTER_IDS, MAX_NAME_LENGTH } from "@brain-rizz/shared";
import { CheckIcon, CloudIcon, HardDriveIcon, UserIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type AuthStatus, useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { type Profile, saveProfile } from "../profile";

interface ProfileScreenProps {
  profile: Profile;
  onBack(): void;
  onConfirm(profile: Profile): void;
}

/**
 * "Hồ sơ của bạn": thẻ danh thiếp (nhân vật + tên + trạng thái tài khoản) và lưới bạn đồng hành.
 * Độ khó không chọn ở đây nữa (màn giới thiệu game nhớ lựa chọn), nhưng vẫn giữ nguyên trong hồ sơ.
 */
export function ProfileScreen({ profile, onBack, onConfirm }: ProfileScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const trimmed = name.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed) onConfirm({ ...profile, name: trimmed, avatar });
  }

  // Sang màn Tài khoản giữa chừng: lưu tên + nhân vật đang sửa để không mất (tên trống thì giữ tên cũ).
  function saveDraft() {
    saveProfile({ ...profile, name: trimmed || profile.name, avatar });
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
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6">
          {/* Thẻ danh thiếp */}
          <Card className="gap-0 py-0">
            <div className="flex flex-col items-center gap-1 border-b-[3px] border-sticker bg-primary px-4 pt-4 pb-3 text-primary-foreground">
              <Character id={avatar} mood="happy" size={140} />
              <span className="font-display text-3xl leading-none font-extrabold">
                {t(`characters.${avatar}.name`)}
              </span>
              <span className="text-sm text-primary-foreground/75">
                {t(`characters.${avatar}.species`)}
              </span>
            </div>
            <div className="flex flex-col gap-4 p-4">
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
              <AccountLine beforeOpen={saveDraft} />
            </div>
          </Card>

          {/* Lưới bạn đồng hành */}
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-3 font-display text-2xl leading-none font-extrabold text-chalk">
              {t("home.profile.buddies")}
            </legend>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {CHARACTER_IDS.map((id, i) => {
                const picked = id === avatar;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => setAvatar(id)}
                    className={cn(
                      "relative flex cursor-pointer flex-col items-center rounded-3xl border-[3px] border-sticker px-1 pt-2 pb-3 text-card-foreground shadow-sticker transition-[translate,box-shadow] outline-none hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring active:translate-y-1 active:shadow-none",
                      picked ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {picked && (
                      <span className="absolute -top-3 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-sticker bg-compute text-paper">
                        <CheckIcon aria-hidden className="size-4" strokeWidth={3.5} />
                      </span>
                    )}
                    <Character
                      id={id}
                      mood={picked ? "happy" : "idle"}
                      size={72}
                      delay={-0.5 * i}
                    />
                    <span className="mt-1 font-display text-lg leading-none font-extrabold md:text-xl">
                      {t(`characters.${id}.name`)}
                    </span>
                    <span
                      className={cn(
                        "text-center text-xs",
                        picked ? "text-primary-foreground/75" : "text-muted-foreground",
                      )}
                    >
                      {t(`characters.${id}.species`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mt-auto flex justify-end gap-3">
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
      </form>
    </main>
  );
}

type AccountKey = `home.profile.${"accountGoogle" | "accountGuest" | "accountLocal"}`;

const ACCOUNT_LINE: Record<AuthStatus, { key: AccountKey; Icon: typeof CloudIcon }> = {
  google: { key: "home.profile.accountGoogle", Icon: CloudIcon },
  guest: { key: "home.profile.accountGuest", Icon: UserIcon },
  "signed-out": { key: "home.profile.accountLocal", Icon: HardDriveIcon },
  unknown: { key: "home.profile.accountLocal", Icon: HardDriveIcon },
  "not-configured": { key: "home.profile.accountLocal", Icon: HardDriveIcon },
};

/** Dòng trạng thái tài khoản trong thẻ danh thiếp; không cấu hình Supabase thì ẩn nút Tài khoản. */
function AccountLine({ beforeOpen }: { beforeOpen(): void }) {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const go = useNav((s) => s.go);
  const { key, Icon } = ACCOUNT_LINE[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-border pt-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
        {t(key)}
      </span>
      {status !== "not-configured" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            beforeOpen();
            go("account");
          }}
        >
          {t("home.profile.account")}
        </Button>
      )}
    </div>
  );
}
