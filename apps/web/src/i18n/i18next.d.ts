import type { GameId } from "@brain-rizz/shared";
import "i18next";
import type { GameLocale } from "@/games/types";
import type { AdminLocaleMessages } from "./locales/admin/vi";
import type { SoloLocaleMessages } from "./locales/solo/vi";
import type { LocaleMessages } from "./locales/vi";

// Khoá dịch có kiểu: gõ sai `t("lobby.strat")` là TypeScript báo lỗi.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      // Chữ các màn một mình (i18n/solo.ts) và trang quản trị (i18n/admin.ts) nằm ở chunk tải lười
      // nhưng cùng namespace `common`.
      common: LocaleMessages & SoloLocaleMessages & AdminLocaleMessages;
      games: Record<GameId, GameLocale>;
    };
  }
}
