import type { CharacterId } from "@brain-rizz/shared";
import {
  type LucideIcon,
  RotateCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  WifiOffIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLoadingWhile } from "@/stores/top-loading.store";
import type { AdminLoad } from "../admin.store";
import { colorIndexFor } from "../format";
import { type AdminSection, SECTION_ICON } from "../sections";

/*
 * Mảnh giao diện dùng chung của trang quản trị (ui-ux 6.9): thẻ bảng, chip, nhóm nút, ô tìm,
 * trạng thái tải / trống / lỗi. Chỉ dùng token (bg-card, text-muted-foreground…) để tự đổi sáng/tối.
 * Bố cục điện thoại ↔ máy tính đổi theo bề rộng vùng nội dung (container query `@min-[820px]`).
 */

/** Thẻ bảng: viền 3,5 bo 20, bóng nhãn dán. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[20px] border-[3.5px] border-sticker bg-card text-card-foreground shadow-sticker-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Hàng đầu thẻ: tiêu đề, bộ lọc, nút phụ (xuống dòng khi hẹp). */
export function PanelHead({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 px-3 pt-3 pb-2 @min-[820px]:px-4 @min-[820px]:pt-3.5 @min-[820px]:pb-2.5",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("m-0 font-display text-lg leading-tight font-extrabold", className)}
      {...props}
    />
  );
}

/** Chân thẻ: ghi chú nhỏ + nút (Tải thêm, phân trang). */
export function PanelFoot({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 border-t border-card-foreground/15 px-3 py-3 text-[12.5px] text-muted-foreground @min-[820px]:px-4",
        className,
      )}
      {...props}
    />
  );
}

const CHIP_TONE = {
  sun: "bg-primary text-ink",
  sky: "bg-sky text-ink",
  mint: "bg-mint text-ink",
  pink: "bg-pink text-ink",
  grape: "bg-grape text-ink",
  muted: "bg-muted text-card-foreground",
  card: "bg-card text-card-foreground",
  dashed: "border-dashed border-muted-foreground bg-transparent text-muted-foreground",
} as const;

export type ChipTone = keyof typeof CHIP_TONE;

export function Chip({
  tone = "muted",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border-2 border-sticker px-2.5 text-xs font-bold whitespace-nowrap",
        CHIP_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Nhóm nút chọn một (lọc, chỉ số biểu đồ): nút đang chọn nền mực chữ vàng, `aria-pressed`. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<NoInfer<T>>[];
  onChange(value: NoInfer<T>): void;
  className?: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className={cn(
        "m-0 inline-flex max-w-full min-w-0 gap-[3px] overflow-x-auto rounded-[14px] border-[2.5px] border-sticker bg-muted p-[3px]",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 shrink-0 cursor-pointer rounded-[10px] px-3 text-[13.5px] font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on
                ? "bg-secondary text-secondary-foreground"
                : "text-card-foreground hover:bg-accent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Ô tìm kiếm có kính lúp, cao 44. */
export function SearchInput({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <span className={cn("relative flex min-w-0 flex-1", className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        className="h-11 rounded-xl border-[2.5px] pl-9 text-[15px]"
        {...props}
      />
    </span>
  );
}

/** Nút tròn Làm mới (phấn, 44 px) ở đầu mục. */
export function RefreshButton({ onClick, busy }: { onClick(): void; busy?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="chalk"
      size="icon-chalk"
      aria-label={t("admin.refresh")}
      title={t("admin.refresh")}
      onClick={onClick}
      aria-busy={busy}
    >
      <RotateCwIcon className={cn("size-[18px]", busy && "motion-safe:animate-spin")} />
    </Button>
  );
}

/** Avatar 30 px + tên + dòng phụ (email…), dùng ở các bảng người chơi. */
export function PersonCell({
  userId,
  avatar,
  name,
  sub,
  badge,
  className,
}: {
  userId: string;
  avatar: CharacterId;
  name: string;
  sub?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <PlayerAvatar avatar={avatar} colorIndex={colorIndexFor(userId)} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-bold">{name}</span>
          {badge}
        </span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}

/** Ô icon vuông viền mực của trạng thái trống / lỗi / cổng. */
export function IconTile({
  icon: Icon,
  tone,
  size = "md",
}: {
  icon: LucideIcon;
  tone: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border-[3px] border-ink text-ink",
        size === "lg" ? "size-16 rounded-[18px]" : "size-15 rounded-2xl",
        tone,
      )}
    >
      <Icon aria-hidden className={size === "lg" ? "size-8" : "size-7.5"} strokeWidth={2.3} />
    </span>
  );
}

/** Đang tải: thẻ có khung xám nhấp nháy, `aria-busy`, kèm thanh tải trên đầu trang. */
export function LoadingPanel({ section, rows = 7 }: { section: AdminSection; rows?: number }) {
  const { t } = useTranslation();
  useLoadingWhile(true);
  return (
    <Panel aria-busy="true" className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-18" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: hàng giữ chỗ cố định, không đổi thứ tự
        <div key={i} className="flex h-8.5 items-center gap-2.5">
          <Skeleton className="size-7.5 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-[18%]" />
          <Skeleton className="hidden h-3 w-[14%] @min-[820px]:block" />
        </div>
      ))}
      <output className="block text-[12.5px] text-muted-foreground">
        {t("admin.state.loading", { what: t(`admin.sections.${section}.lower`) })}
      </output>
    </Panel>
  );
}

/** Trống: ô icon của mục + câu riêng. */
export function EmptyPanel({
  section,
  title,
  body,
}: {
  section: AdminSection;
  title?: string;
  body?: string;
}) {
  const { t } = useTranslation();
  return (
    <Panel className="flex flex-col items-center gap-2.5 px-5 py-10 text-center shadow-sticker-sm">
      <IconTile icon={SECTION_ICON[section]} tone="bg-mint" />
      <h2 className="m-0 font-display text-[21px] font-extrabold">
        {title ?? t(`admin.sections.${section}.emptyTitle`)}
      </h2>
      <p className="m-0 max-w-[46ch] text-[13.5px] leading-normal text-muted-foreground">
        {body ?? t(`admin.sections.${section}.emptyBody`)}
      </p>
    </Panel>
  );
}

/** Lỗi: thẻ `role="alert"` + Thử lại; các mục khác vẫn dùng được. */
export function ErrorPanel({
  section,
  reason,
  server,
  onRetry,
}: {
  section: AdminSection;
  reason: string;
  /** Lỗi đến từ game server (mục Phòng đang mở) thay vì máy chủ dữ liệu. */
  server?: boolean;
  onRetry(): void;
}) {
  const { t } = useTranslation();
  const body =
    reason === "server-unconfigured"
      ? t("admin.state.serverUnconfiguredBody")
      : server
        ? t("admin.state.serverErrorBody")
        : t("admin.state.errorBody");
  return (
    <Panel role="alert" className="flex flex-col items-center gap-2.5 px-5 py-10 text-center">
      <IconTile icon={server ? WifiOffIcon : TriangleAlertIcon} tone="bg-pink" />
      <h2 className="m-0 font-display text-[21px] font-extrabold">
        {t("admin.state.errorTitle", { what: t(`admin.sections.${section}.lower`) })}
      </h2>
      <p className="m-0 max-w-[46ch] text-[13.5px] leading-normal text-muted-foreground">{body}</p>
      <Button variant="outline" onClick={onRetry} className="min-h-11">
        <RotateCwIcon aria-hidden />
        {t("common.retry")}
      </Button>
    </Panel>
  );
}

/**
 * Trạng thái chung của một mục: đang tải / lỗi (mất quyền thì store đưa trang về cổng nên ở đây chỉ
 * giữ khung tải). Trả `null` khi đã có dữ liệu để mục tự vẽ.
 */
export function SectionState<T>({
  state,
  section,
  server,
  onRetry,
}: {
  state: AdminLoad<T>;
  section: AdminSection;
  server?: boolean;
  onRetry(): void;
}) {
  if (state.status === "ok") return null;
  if (state.status === "loading" || state.status === "forbidden" || state.status === "no-session") {
    return <LoadingPanel section={section} />;
  }
  return <ErrorPanel section={section} reason={state.status} server={server} onRetry={onRetry} />;
}

/** Đầu mỗi mục: tiêu đề phấn 30 px + một dòng mô tả; nút phụ căn phải. */
export function SectionHeader({
  section,
  children,
}: {
  section: AdminSection;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold text-chalk">
          {t(`admin.sections.${section}.title`)}
        </h1>
        <p className="m-0 text-[13.5px] text-chalk-muted">{t(`admin.sections.${section}.sub`)}</p>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] text-chalk-muted">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Bảng dữ liệu: thẻ `<table>` thật (trình đọc màn hình đọc được hàng/cột) nhưng mỗi hàng là lưới CSS
 * để đổi bố cục: máy tính đủ cột; điện thoại ẩn tiêu đề cột và cột phụ, hàng thành 2 dòng.
 */
export function DataTable({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("block w-full border-collapse", className)} {...props} />;
}

/** Hàng tiêu đề cột (ẩn trên điện thoại): 11 px in hoa. `className` đặt lưới cột như các hàng. */
export function HeadRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <thead className="hidden @min-[820px]:block">
      <tr
        className={cn(
          "grid items-end gap-2.5 px-4 pb-1.5 text-[11px] tracking-[0.8px] text-muted-foreground uppercase",
          className,
        )}
        {...props}
      />
    </thead>
  );
}

/** Ô tiêu đề cột (căn trái, đậm; số thì thêm `text-right`). */
export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("p-0 text-left font-bold", className)} {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody className="block" {...props} />;
}

/** Một hàng bảng ≥ 48 px, vạch mờ, hàng chẵn nền mờ 4%. */
export function Row({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "grid min-h-12 items-center gap-x-2.5 gap-y-1.5 border-t border-card-foreground/15 px-3 py-2.5 text-[13.5px] even:bg-card-foreground/[0.04] @min-[820px]:px-4 @min-[820px]:py-1.5 [&>td]:p-0",
        className,
      )}
      {...props}
    />
  );
}

/** Ô chỉ hiện trên máy tính. */
export const desktopOnly = "hidden @min-[820px]:block";
/** Dòng phụ chỉ hiện trên điện thoại (gom các cột bị ẩn), trải hết hàng. */
export const mobileOnly = "col-span-full text-xs text-muted-foreground @min-[820px]:hidden";
