import type { GameId } from "@brain-rizz/shared";
import "i18next";
import type { GameLocale } from "@/games/types";
import type { LocaleMessages } from "./locales/vi";

// Khoá dịch có kiểu: gõ sai `t("lobby.strat")` là TypeScript báo lỗi.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: LocaleMessages;
      games: Record<GameId, GameLocale>;
    };
  }
}
