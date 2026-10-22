import { BOT_LEVELS, type BotLevel, isBotLevel } from "@brain-rizz/shared";
import { CheckIcon, ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/*
 * Mức bot (CR-016, ui-ux 6.6): nhãn mức trên ô bot, ô chọn mức (hộp thoại "Chơi với máy", thêm bot
 * và đổi mức ngay trong ô ở phòng chờ). Màu giữ nguyên ở sáng/tối, chữ mực, kèm 4 vạch "độ mạnh"
 * nên không chỉ phân biệt bằng màu.
 */

/** Màu từng mức — viết sẵn từng class để Tailwind sinh ra được. */
export const BOT_LEVEL_BG: Record<BotLevel, string> = {
  0: "bg-mint",
  1: "bg-sky",
  2: "bg-identify",
  3: "bg-pink",
};

/** Vạch thứ i cao dần; `size` theo chỗ đặt: nhãn nhỏ, ô chọn trong ô người chơi, ô chọn hộp thoại. */
const BAR_HEIGHT = {
  chip: ["h-0.75", "h-1.25", "h-1.5", "h-2"],
  slot: ["h-1", "h-1.25", "h-1.75", "h-2.25"],
  dialog: ["h-1", "h-1.5", "h-2", "h-2.5"],
} as const;

const BAR_WIDTH = { chip: "w-0.5", slot: "w-0.75", dialog: "w-0.75" } as const;

/** 4 vạch độ mạnh: số vạch đậm = mức + 1. */
export function BotLevelBars({
  level,
  size = "slot",
}: {
  level: BotLevel;
  size?: keyof typeof BAR_HEIGHT;
}) {
  return (
    <span aria-hidden className="inline-flex items-end gap-0.5">
      {BAR_HEIGHT[size].map((h, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 4 vạch cố định
          key={i}
          className={cn(
            "block rounded-[1px]",
            BAR_WIDTH[size],
            h,
            i <= level ? "bg-ink" : "bg-ink/22",
          )}
        />
      ))}
    </span>
  );
}

/** Nhãn mức trên ô bot ("Vừa ▂▄▆"). `editable` thêm mũi tên (chủ phòng bấm để đổi mức). */
export function BotLevelChip({
  level,
  editable = false,
  className,
}: {
  level: BotLevel;
  editable?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.25 rounded-full border-2 border-sticker pl-2.25 text-xs font-bold whitespace-nowrap text-ink lg:h-6.5 lg:text-[13px]",
        editable ? "pr-1.5" : "pr-2.25",
        BOT_LEVEL_BG[level],
        className,
      )}
    >
      {t(`bots.level.${level}`)}
      <BotLevelBars level={level} size="chip" />
      {editable && <ChevronDownIcon aria-hidden className="size-3.25" strokeWidth={3} />}
    </span>
  );
}

const OPTION_SIZE = {
  /** Trong ô người chơi ở phòng chờ: 44 px. */
  slot: "h-11 gap-0.75 rounded-xl",
  /** Hộp thoại "Chơi với máy": 50 / 54 px. */
  dialog: "h-12.5 gap-1.25 rounded-[14px] sm:h-13.5",
} as const;

const NAME_SIZE = { slot: "text-base", dialog: "text-[17px] sm:text-[19px]" } as const;

/** Lớp chung của một ô chọn mức; `selected` có vòng vàng như chọn nhân vật ở phòng chờ. */
function optionClass(level: BotLevel, size: keyof typeof OPTION_SIZE, selected: boolean) {
  return cn(
    "relative flex min-w-0 cursor-pointer flex-col items-center justify-center border-[2.5px] border-sticker px-0.5 text-ink transition-[translate,box-shadow,opacity] outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
    OPTION_SIZE[size],
    BOT_LEVEL_BG[level],
    selected
      ? "shadow-[0_0_0_4px_var(--color-primary),0_0_0_6.5px_var(--color-sticker)]"
      : "shadow-[0_3px_0_var(--color-sticker)] active:translate-y-0.5 active:shadow-none",
  );
}

/** Nội dung một ô chọn: tên mức + vạch, hoặc vòng xoay khi đang chờ máy chủ. */
function OptionFace({
  level,
  size,
  busy,
  busyLabel,
}: {
  level: BotLevel;
  size: keyof typeof OPTION_SIZE;
  busy?: boolean;
  busyLabel?: string;
}) {
  const { t } = useTranslation();
  if (busy) {
    return (
      <>
        <LoaderCircleIcon
          aria-hidden
          className="size-5 motion-safe:animate-spin"
          strokeWidth={2.8}
        />
        {busyLabel && <span className="sr-only">{busyLabel}</span>}
      </>
    );
  }
  return (
    <>
      <span className={cn("font-display leading-none font-extrabold", NAME_SIZE[size])}>
        {t(`bots.level.${level}`)}
      </span>
      <BotLevelBars level={level} size={size} />
    </>
  );
}

/** Dấu tích tròn góc trên phải của ô đang chọn. */
function SelectedMark({ size }: { size: keyof typeof OPTION_SIZE }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute grid place-items-center rounded-full border-2 border-sticker bg-ink text-primary",
        size === "dialog" ? "-top-2.5 -right-2.5 size-5.5" : "-top-2.25 -right-2.25 size-5",
      )}
    >
      <CheckIcon className="size-3" strokeWidth={3.4} />
    </span>
  );
}

interface BotLevelPickerProps {
  value: BotLevel;
  onChange(level: BotLevel): void;
  size: keyof typeof OPTION_SIZE;
  /** Tên nhóm cho trình đọc màn hình. */
  label: string;
  disabled?: boolean;
  className?: string;
  /** Ô của mức đang chọn (để focus khi mở). */
  selectedRef?: Ref<HTMLButtonElement>;
}

/**
 * Chọn một trong 4 mức (radio, mũi tên di chuyển): hộp thoại "Chơi với máy" và đổi mức bot ở
 * phòng chờ. Không cho bỏ chọn.
 */
export function BotLevelPicker({
  value,
  onChange,
  size,
  label,
  disabled,
  className,
  selectedRef,
}: BotLevelPickerProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={String(value)}
      // Bấm lại mục đang chọn ra "" — bỏ qua để luôn có một mức.
      onValueChange={(v) => {
        const level = Number(v);
        if (v && isBotLevel(level)) onChange(level);
      }}
      aria-label={label}
      disabled={disabled}
      className={cn("grid", className)}
    >
      {BOT_LEVELS.map((level) => (
        <ToggleGroupPrimitive.Item
          key={level}
          value={String(level)}
          ref={level === value ? selectedRef : undefined}
          className={optionClass(level, size, level === value)}
        >
          <OptionFace level={level} size={size} />
          {level === value && <SelectedMark size={size} />}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

interface BotLevelButtonsProps {
  onPick(level: BotLevel): void;
  /** Mức đang chờ máy chủ thêm: ô đó quay vòng, các ô khác khoá. */
  pending?: BotLevel | null;
  /** aria-label của từng ô ("Thêm bot mức Vừa"). */
  labelOf(level: BotLevel): string;
  busyLabel: string;
  className?: string;
  /** Ô "Vừa" (focus khi mở). */
  defaultRef?: Ref<HTMLButtonElement>;
}

/** 4 nút thêm bot theo mức (mỗi nút là một hành động, không phải lựa chọn). */
export function BotLevelButtons({
  onPick,
  pending = null,
  labelOf,
  busyLabel,
  className,
  defaultRef,
}: BotLevelButtonsProps) {
  return (
    <div className={cn("grid", className)}>
      {BOT_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          ref={level === 1 ? defaultRef : undefined}
          aria-label={labelOf(level)}
          aria-busy={pending === level || undefined}
          disabled={pending !== null && pending !== level}
          onClick={() => {
            if (pending === null) onPick(level);
          }}
          className={optionClass(level, "slot", false)}
        >
          <OptionFace level={level} size="slot" busy={pending === level} busyLabel={busyLabel} />
        </button>
      ))}
    </div>
  );
}
