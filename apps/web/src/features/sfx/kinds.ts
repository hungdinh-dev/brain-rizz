/**
 * Loại âm thanh hiệu ứng (FR-GD-07) và cách chọn loại cho một phần tử được bấm — logic thuần, có test.
 */

export const SFX_KINDS = [
  "click",
  "toggle",
  "confirm",
  "back",
  "error",
  "tick",
  "correct",
  "wrong",
] as const;

export type SfxKind = (typeof SFX_KINDS)[number];

/** Giá trị của thuộc tính `data-sfx` trên nút: ghi đè tiếng mặc định, `none` = im. */
export type SfxAttr = "click" | "toggle" | "confirm" | "back" | "none";

const ATTRS: readonly string[] = ["click", "toggle", "confirm", "back", "none"];

export function isSfxKind(value: string): value is SfxKind {
  return (SFX_KINDS as readonly string[]).includes(value);
}

export function parseSfxAttr(raw: string | null): SfxAttr | null {
  return raw !== null && ATTRS.includes(raw) ? (raw as SfxAttr) : null;
}

/** Vai trò ARIA kiểu "chọn một / bật tắt" → tiếng toggle. */
const TOGGLE_ROLES: readonly string[] = ["switch", "radio", "tab", "checkbox"];

/**
 * Chọn tiếng cho phần tử vừa được bấm:
 * bị khoá → im; có `data-sfx` → theo đó; nút bật/tắt (`aria-pressed`, role switch/radio/tab) → toggle;
 * còn lại → click.
 */
export function resolveSfxKind(el: {
  attr: string | null;
  role: string | null;
  pressed: boolean;
  disabled: boolean;
}): SfxKind | null {
  if (el.disabled) return null;
  const attr = parseSfxAttr(el.attr);
  if (attr === "none") return null;
  if (attr) return attr;
  if (el.pressed || (el.role !== null && TOGGLE_ROLES.includes(el.role))) return "toggle";
  return "click";
}
