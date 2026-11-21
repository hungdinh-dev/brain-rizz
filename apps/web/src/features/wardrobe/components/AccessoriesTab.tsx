import {
  COSMETIC_ITEMS,
  COSMETIC_SLOTS,
  type CosmeticId,
  type CosmeticSlot,
  getCosmetic,
  sanitizeLoadout,
} from "@brain-rizz/shared";
import { BanIcon, CheckIcon, PlusIcon, ShirtIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AccessoryIcon } from "@/components/characters";
import { RarityBadge } from "@/components/common/RarityBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { currentProfile, saveAccessories } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth.store";
import { useLoadingWhile } from "@/stores/top-loading.store";
import { useWallet } from "@/stores/wallet.store";

/** Toast đeo / bỏ món: 2,2 giây (ui-ux 6.12). */
const TOAST_MS = 2_200;

interface AccessoriesTabProps {
  /** "Mặc thử" từ màn mở quà: đeo ngay món này và mở đúng chỗ của nó. */
  tryOn?: CosmeticId;
  /** Sang Máy quay (ô "Lấy thêm", màn trống). */
  onMachine(): void;
  /**
   * Nhân vật nhỏ đang đeo, đặt cạnh 3 chỗ đeo trong hàng dính trên cùng (điện thoại / máy tính bảng
   * dọc: thẻ hồ sơ đã cuộn khuất mà vẫn thấy món vừa đeo). Từ `md` trở lên thẻ hồ sơ đã dính bên
   * cạnh nên hàng này thôi dính và ẩn nhân vật nhỏ.
   */
  preview?: React.ReactNode;
}

/**
 * Tab Phụ kiện của trang Hồ sơ (Tủ đồ cũ, S20, ui-ux 6.12): 3 chỗ (Đầu / Mặt / Cổ) và lưới món đã
 * có của chỗ đang chọn; nhân vật đang đeo vẽ ở thẻ hồ sơ bên cạnh. Bấm = đeo, bấm lại / "Không đeo"
 * = bỏ. Lưu ngay vào hồ sơ trên máy (gửi kèm khi vào phòng; server lọc theo món sở hữu). Chưa kết
 * nối: vẫn mặc được món đang lưu trên máy. Tải lười cùng chữ 24 món (i18n/gacha).
 */
export function AccessoriesTab({ tryOn, onMachine, preview }: AccessoriesTabProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const authStatus = useAuth((s) => s.status);
  const [worn, setWorn] = useState<string[]>(() => sanitizeLoadout(currentProfile().accessories));
  const [slot, setSlot] = useState<CosmeticSlot>(
    () => (tryOn && getCosmetic(tryOn)?.slot) || "head",
  );
  const itemsStatus = useWallet((s) => s.itemsStatus);
  const items = useWallet((s) => s.items);

  // Đọc ví + món đã có; đọc lại khi trạng thái phiên đổi (vd. vừa đăng nhập).
  // biome-ignore lint/correctness/useExhaustiveDependencies: đọc lại khi trạng thái phiên đổi
  useEffect(() => {
    void useWallet.getState().load();
    void useWallet.getState().loadItems();
  }, [authStatus]);

  // Món đã có: từ máy chủ; chưa kết nối / lỗi → chỉ những món đang lưu trên máy.
  const owned: readonly string[] | null =
    itemsStatus === "ok" || itemsStatus === "no-session"
      ? (items ?? [])
      : itemsStatus === "loading"
        ? null
        : worn;
  const offline = itemsStatus === "offline" || itemsStatus === "error";
  // Đang đọc món đã có (khung xương trong thẻ lưới món) → thanh tải trên đầu.
  useLoadingWhile(owned === null);

  // Món đang đeo mà máy chủ nói không còn sở hữu (`my_items`: đổi tài khoản, bị thu hồi…) → bỏ khỏi
  // hồ sơ trên máy, để xem trước khớp với điều cả phòng thấy (server cũng lọc theo sở hữu). Chỉ đối
  // chiếu với danh sách đọc về sau khi mở tab: danh sách đang có trong store có thể của phiên trước.
  // Đọc lại hồ sơ (không dùng `worn` của lần render) để không ghi đè món vừa "Mặc thử".
  const itemsAtMount = useRef(items);
  useEffect(() => {
    if (itemsStatus !== "ok" || !items || items === itemsAtMount.current) return;
    const current = sanitizeLoadout(currentProfile().accessories);
    const kept = current.filter((id) => items.includes(id as CosmeticId));
    if (kept.length !== current.length) setWorn(saveAccessories(kept));
  }, [itemsStatus, items]);

  function save(next: string[]) {
    const saved = saveAccessories(next);
    setWorn(saved);
    return saved;
  }

  function wear(id: CosmeticId) {
    const item = getCosmetic(id);
    if (!item) return;
    save([id, ...worn.filter((w) => getCosmetic(w)?.slot !== item.slot)]);
    toast(t("wardrobe.worn", { name: t(`gacha.items.${id}`) }), { duration: TOAST_MS });
  }

  function remove(target: CosmeticSlot) {
    if (!worn.some((w) => getCosmetic(w)?.slot === target)) return;
    save(worn.filter((w) => getCosmetic(w)?.slot !== target));
    toast(t(`wardrobe.removed.${target}`), { duration: TOAST_MS });
  }

  // "Mặc thử": đeo một lần (StrictMode chạy effect hai lần → nhớ món đã đeo thử).
  const triedOn = useRef<string | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi món "Mặc thử" đổi
  useEffect(() => {
    if (!tryOn || triedOn.current === tryOn) return;
    triedOn.current = tryOn;
    const item = getCosmetic(tryOn);
    if (item) setSlot(item.slot);
    if (!worn.includes(tryOn)) wear(tryOn);
  }, [tryOn]);

  const wornBySlot = (s: CosmeticSlot) => worn.find((w) => getCosmetic(w)?.slot === s);
  const slotItems = owned
    ? COSMETIC_ITEMS.filter((item) => item.slot === slot && owned.includes(item.id))
    : [];
  const empty = owned !== null && owned.length === 0;

  const cols = desktop ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className="flex flex-col gap-4">
      {!empty && (
        <div className="sticky top-0 z-20 -mx-1.5 flex items-center gap-2 rounded-b-2xl bg-background px-1.5 py-2 md:static md:mx-0 md:bg-transparent md:p-0">
          {preview && <div className="shrink-0 md:hidden">{preview}</div>}
          <fieldset className="grid min-w-0 flex-1 grid-cols-3 gap-2.5">
            <legend className="sr-only">{t("wardrobe.slotsLabel")}</legend>
            {COSMETIC_SLOTS.map((s) => {
              const id = wornBySlot(s);
              const itemName = id ? t(`gacha.items.${id as CosmeticId}`) : t("wardrobe.notWorn");
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={slot === s}
                  aria-label={t("wardrobe.slotAria", {
                    slot: t(`gacha.slots.${s}`),
                    item: itemName,
                  })}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "flex min-h-14 min-w-0 cursor-pointer items-center rounded-2xl border-[3px] border-sticker shadow-sticker-sm transition-[translate,box-shadow] active:translate-y-1 active:shadow-none",
                    // Ô hẹp (điện thoại ~100 px, máy tính ~120 px) → xếp dọc để tên món đủ chỗ.
                    "flex-col justify-center gap-0.5 px-1 py-1.5 text-center",
                    slot === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground hover:-translate-y-0.5",
                  )}
                >
                  {id ? (
                    <AccessoryIcon id={id} size={desktop ? 30 : 24} />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 rounded-full border-2 border-dashed border-current opacity-50",
                        desktop ? "size-7.5" : "size-6",
                      )}
                    />
                  )}
                  <span className="flex w-full min-w-0 flex-col leading-tight">
                    <span className="font-display text-base leading-none font-extrabold">
                      {t(`gacha.slots.${s}`)}
                    </span>
                    <span className="truncate text-xs opacity-80">{itemName}</span>
                  </span>
                </button>
              );
            })}
          </fieldset>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {empty ? (
          <EmptyWardrobe onMachine={onMachine} />
        ) : (
          <section
            aria-labelledby="wardrobe-slot-title"
            className="flex flex-col gap-3 rounded-3xl border-[3px] border-sticker bg-card p-3.5 text-card-foreground shadow-sticker lg:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="wardrobe-slot-title" className="font-display text-xl font-extrabold">
                {t(`gacha.slots.${slot}`)}
                {owned && (
                  <span className="ml-2 font-sans text-sm font-semibold text-muted-foreground">
                    {t("wardrobe.slotCount", { count: slotItems.length })}
                  </span>
                )}
              </h2>
              {desktop && (
                <span className="text-[13px] text-muted-foreground">{t("wardrobe.hint")}</span>
              )}
            </div>
            {owned === null ? (
              <div aria-busy="true" className={cn("grid gap-2.5", cols)}>
                <span className="sr-only">{t("common.loading")}</span>
                {Array.from({ length: desktop ? 5 : 4 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: khung xương cố định
                  <Skeleton key={i} className={desktop ? "h-32" : "h-25"} />
                ))}
              </div>
            ) : (
              <ul className={cn("grid gap-2.5", cols)}>
                <li>
                  <Tile
                    desktop={desktop}
                    pressed={!wornBySlot(slot)}
                    dashed
                    label={t("wardrobe.none")}
                    onClick={() => remove(slot)}
                  >
                    <BanIcon
                      aria-hidden
                      className={desktop ? "size-12" : "size-9"}
                      strokeWidth={2}
                    />
                  </Tile>
                </li>
                {slotItems.map((item) => {
                  const on = worn.includes(item.id);
                  return (
                    <li key={item.id}>
                      <Tile
                        desktop={desktop}
                        pressed={on}
                        label={t(`gacha.items.${item.id}`)}
                        onClick={() => (on ? remove(item.slot) : wear(item.id))}
                        badge={
                          <RarityBadge
                            rarity={item.rarity}
                            label={t(`gacha.rarity.${item.rarity}`)}
                            size="xs"
                            className="absolute -top-2 -left-1.5"
                          />
                        }
                      >
                        <AccessoryIcon id={item.id} size={desktop ? 64 : 46} />
                      </Tile>
                    </li>
                  );
                })}
                {!offline && (
                  <li>
                    <Tile
                      desktop={desktop}
                      dashed
                      label={t("wardrobe.getMore")}
                      onClick={onMachine}
                    >
                      <PlusIcon
                        aria-hidden
                        className={desktop ? "size-12" : "size-9"}
                        strokeWidth={2.4}
                      />
                    </Tile>
                  </li>
                )}
              </ul>
            )}
            {slotItems.length === 0 && owned !== null && (
              <p className="text-sm text-muted-foreground">{t("wardrobe.slotEmpty")}</p>
            )}
          </section>
        )}
        {offline && <p className="text-[13px] text-chalk-muted">{t("wardrobe.offlineNote")}</p>}
        <p className="text-[13px] text-chalk-muted">{t("wardrobe.footer")}</p>
      </div>
    </div>
  );
}

function Tile({
  desktop,
  pressed,
  dashed = false,
  label,
  onClick,
  badge,
  children,
}: {
  desktop: boolean;
  pressed?: boolean;
  dashed?: boolean;
  label: string;
  onClick(): void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-[2.5px] px-1 text-center transition-transform active:translate-y-0.5",
        desktop ? "h-32" : "h-25",
        dashed ? "border-dashed border-muted-foreground/60" : "border-sticker",
        pressed ? "border-solid border-sticker bg-primary text-primary-foreground" : "bg-muted",
      )}
    >
      {badge}
      {children}
      <span className="line-clamp-2 text-xs leading-tight font-semibold">{label}</span>
      {pressed && !dashed && (
        <span
          aria-hidden
          className="absolute -top-2 -right-1.5 grid size-5.5 place-items-center rounded-full border-[2.5px] border-ink bg-compute text-ink"
        >
          <CheckIcon className="size-3" strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

/** Chưa có món nào: móc áo nét đứt + lối sang Máy quay. */
function EmptyWardrobe({ onMachine }: { onMachine(): void }) {
  const { t } = useTranslation();
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-2.5 rounded-3xl border-[3px] border-sticker bg-card px-4 py-6 text-center text-card-foreground shadow-sticker"
    >
      <span className="grid size-16 place-items-center rounded-2xl border-[3px] border-dashed border-muted-foreground">
        <ShirtIcon aria-hidden className="size-8" strokeWidth={2.2} />
      </span>
      <h2 className="font-display text-[22px] leading-tight font-extrabold">
        {t("wardrobe.emptyTitle")}
      </h2>
      <p className="max-w-80 text-sm text-muted-foreground">{t("wardrobe.emptyBody")}</p>
      <Button className="mt-1" onClick={onMachine}>
        {t("wardrobe.emptyCta")}
      </Button>
    </section>
  );
}
