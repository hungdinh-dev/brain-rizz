/** Ngôn ngữ giao diện được hỗ trợ. Ngôn ngữ đầu tiên là mặc định. */
export const LANGUAGES = ["vi", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}
